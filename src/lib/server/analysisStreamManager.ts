import { DreamStatus } from '@prisma/client';
import type { AnalysisStreamChunk } from '$lib/server/n8nService';
import { getAnalysisStore } from '$lib/server/analysisStore';
import { getPrismaClient } from '$lib/server/db';
import { initiateStreamedDreamAnalysis } from '$lib/server/n8nService';

/**
 * Manages the lifecycle of a single dream analysis stream.
 * This class is responsible for:
 * - Receiving the raw stream from the analysis source (e.g., n8n).
 * - Parsing and accumulating chunks.
 * - Persisting intermediate and final states to Redis.
 * - Publishing updates to Redis Pub/Sub.
 * - Updating the database with final results.
 * - Handling cancellation and errors.
 */
export class AnalysisStreamManager {
    private dreamId: string;
    private rawText: string;
    private platform: App.Platform | undefined;
    private analysisStore: Awaited<ReturnType<typeof getAnalysisStore>>;
    private prisma: Awaited<ReturnType<typeof getPrismaClient>>;

    private accumulatedInterpretation: string = '';
    private accumulatedTags: string[] = [];
    private dreamStatusUpdatedInDb: boolean = false;
    private isCancelled: boolean = false;
    private cancellationSubscriber: AisRedis | null = null; // AisRedis is the type returned by analysisStore.subscribeToUpdates

    constructor(dreamId: string, rawText: string, platform: App.Platform | undefined) {
        this.dreamId = dreamId;
        this.rawText = rawText;
        this.platform = platform;
    }

    /**
     * Initializes the manager by getting necessary clients.
     * Must be called before `startAnalysis`.
     */
    public async init() {
        this.analysisStore = await getAnalysisStore();
        this.prisma = await getPrismaClient();
    }

    /**
     * Starts the background analysis process.
     * This method should be called once per dream analysis.
     */
    public async startAnalysis(): Promise<void> {
        if (!this.analysisStore || !this.prisma) {
            throw new Error('AnalysisStreamManager not initialized. Call init() first.');
        }

        // Subscribe to the dream's channel to listen for cancellation signals
        this.cancellationSubscriber = this.analysisStore.subscribeToUpdates(this.dreamId, (message) => {
            if (message.finalStatus === DreamStatus.ANALYSIS_FAILED && message.message === 'Analysis cancelled by user.') {
                console.log(`Dream ${this.dreamId}: Manager received cancellation signal.`);
                this.isCancelled = true;
            }
        });

        try {
            const n8nStream = await initiateStreamedDreamAnalysis(this.dreamId, this.rawText);
            const decoder = new TextDecoder();
            let jsonBuffer = '';

            const backgroundProcessingPromise = n8nStream.pipeTo(new WritableStream({
                async write(chunk) {
                    if (this.isCancelled) {
                        console.log(`Dream ${this.dreamId}: Manager stopping write due to cancellation.`);
                        // Throwing here will cause the pipeTo to abort
                        throw new Error('Analysis cancelled by user.');
                    }

                    jsonBuffer += decoder.decode(chunk, { stream: true });

                    let boundary = jsonBuffer.indexOf('\n');
                    while (boundary !== -1) {
                        const line = jsonBuffer.substring(0, boundary).trim();
                        jsonBuffer = jsonBuffer.substring(boundary + 1);

                        if (line) {
                            try {
                                const parsedChunk: AnalysisStreamChunk = JSON.parse(line);
                                await this.processChunk(parsedChunk);
                            } catch (e) {
                                console.warn(`Dream ${this.dreamId}: Manager failed to parse n8nService stream line or process chunk: ${line}`, e);
                            }
                        }
                        boundary = jsonBuffer.indexOf('\n');
                    }
                },
                close: async () => {
                    await this.handleStreamClose();
                },
                abort: async (reason) => {
                    await this.handleStreamAbort(reason);
                }
            }, { this: this })); // Bind 'this' context for write, close, abort

            // Use platform.context.waitUntil if available (e.g., Cloudflare Workers)
            if (this.platform?.context?.waitUntil) {
                this.platform.context.waitUntil(backgroundProcessingPromise);
            } else {
                // For Node.js environments, just await it or let it run in the background.
                backgroundProcessingPromise.catch(e => {
                    if (e.message !== 'Analysis cancelled by user.') {
                        console.error(`Dream ${this.dreamId}: Unhandled error in background analysis pipeTo:`, e);
                    } else {
                        console.log(`Dream ${this.dreamId}: Background analysis pipeTo aborted by user cancellation.`);
                    }
                });
            }

        } catch (e) {
            console.error(`Dream ${this.dreamId}: Error initiating background n8n stream:`, e);
            await this.handleStreamAbort(e); // Treat initiation errors as an abort
        }
    }

    private async processChunk(parsedChunk: AnalysisStreamChunk): Promise<void> {
        // Accumulate interpretation and tags in memory
        if (parsedChunk.content) {
            this.accumulatedInterpretation += parsedChunk.content;
        }
        if (parsedChunk.tags) {
            this.accumulatedTags = parsedChunk.tags;
        }

        // Update Redis with current progress and publish
        const redisUpdateChunk: AnalysisStreamChunk = {
            content: parsedChunk.content, // Send delta content
            tags: parsedChunk.tags,
            status: parsedChunk.status || DreamStatus.PENDING_ANALYSIS
        };
        await this.analysisStore.updateAnalysis(this.dreamId, redisUpdateChunk, false);
        await this.analysisStore.publishUpdate(this.dreamId, redisUpdateChunk);

        // Database update only on finalStatus or ANALYSIS_FAILED
        if (parsedChunk.finalStatus && !this.dreamStatusUpdatedInDb) {
            await this.updateDreamInDb(parsedChunk.finalStatus);
            this.dreamStatusUpdatedInDb = true;
            console.log(`Dream ${this.dreamId}: Manager updated final status to ${parsedChunk.finalStatus} in DB.`);
            await this.analysisStore.updateAnalysis(this.dreamId, { finalStatus: parsedStatus }, true); // Update Redis with final status
            await this.analysisStore.publishUpdate(this.dreamId, { finalStatus: parsedStatus }); // Publish final status
        } else if (parsedChunk.status === DreamStatus.ANALYSIS_FAILED && !this.dreamStatusUpdatedInDb) {
            await this.updateDreamInDb(DreamStatus.ANALYSIS_FAILED);
            this.dreamStatusUpdatedInDb = true;
            console.log(`Dream ${this.dreamId}: Manager updated final status to ANALYSIS_FAILED (from chunk status) in DB.`);
            await this.analysisStore.updateAnalysis(this.dreamId, { finalStatus: DreamStatus.ANALYSIS_FAILED }, true); // Update Redis with final status
            await this.analysisStore.publishUpdate(this.dreamId, { finalStatus: DreamStatus.ANALYSIS_FAILED }); // Publish final status
        }
    }

    private async handleStreamClose(): Promise<void> {
        await this.analysisStore.unsubscribeFromUpdates(this.cancellationSubscriber!, this.dreamId); // Unsubscribe from cancellation channel

        if (this.isCancelled) {
            console.log(`Dream ${this.dreamId}: Manager closed after cancellation.`);
            // The DB status should have been updated by the DELETE endpoint or the abort handler
        } else if (!this.dreamStatusUpdatedInDb) {
            // If the stream closed without an explicit finalStatus and no error was reported, assume completion
            await this.updateDreamInDb(DreamStatus.COMPLETED);
            console.log(`Dream ${this.dreamId}: Manager finished, status set to COMPLETED in DB.`);
            await this.analysisStore.publishUpdate(this.dreamId, { finalStatus: DreamStatus.COMPLETED, message: 'Analysis completed.' }); // Publish final status
        }
        await this.analysisStore.clearAnalysis(this.dreamId); // Clear from Redis once fully processed
    }

    private async handleStreamAbort(reason: any): Promise<void> {
        await this.analysisStore.unsubscribeFromUpdates(this.cancellationSubscriber!, this.dreamId); // Unsubscribe from cancellation channel

        const errorMessage = reason instanceof Error ? reason.message : String(reason || 'Unknown error');
        console.error(`Dream ${this.dreamId}: Manager aborted:`, errorMessage);

        if (!this.dreamStatusUpdatedInDb) {
            await this.updateDreamInDb(DreamStatus.ANALYSIS_FAILED);
            console.log(`Dream ${this.dreamId}: Manager aborted, status set to ANALYSIS_FAILED in DB.`);
            await this.analysisStore.publishUpdate(this.dreamId, { finalStatus: DreamStatus.ANALYSIS_FAILED, message: `Analysis aborted: ${errorMessage}` }); // Publish final status
        }
        await this.analysisStore.clearAnalysis(this.dreamId); // Clear from Redis on abort
    }

    private async updateDreamInDb(status: DreamStatus): Promise<void> {
        try {
            await this.prisma.dream.update({
                where: { id: this.dreamId },
                data: {
                    status: status,
                    interpretation: this.accumulatedInterpretation,
                    tags: this.accumulatedTags
                }
            });
        } catch (updateError) {
            console.error(`Dream ${this.dreamId}: Failed to update dream status to ${status} in DB:`, updateError);
        }
    }
}

// A map to keep track of active managers to prevent duplicate background processes
const activeAnalysisManagers = new Map<string, AnalysisStreamManager>();

/**
 * Initiates or retrieves an existing AnalysisStreamManager for a given dream.
 * @param dreamId The ID of the dream.
 * @param rawText The raw text of the dream.
 * @param platform The SvelteKit platform object.
 * @returns The AnalysisStreamManager instance.
 */
export async function getOrCreateAnalysisStreamManager(dreamId: string, rawText: string, platform: App.Platform | undefined): Promise<AnalysisStreamManager> {
    if (activeAnalysisManagers.has(dreamId)) {
        return activeAnalysisManagers.get(dreamId)!;
    }

    const manager = new AnalysisStreamManager(dreamId, rawText, platform);
    await manager.init(); // Initialize the manager
    activeAnalysisManagers.set(dreamId, manager);

    // Start the analysis in the background.
    // The manager itself will handle its lifecycle and removal from the map
    // once the analysis is truly complete or failed.
    manager.startAnalysis().finally(() => {
        // Remove from map once the analysis process (including DB updates and Redis cleanup) is done
        activeAnalysisManagers.delete(dreamId);
    });

    return manager;
}
