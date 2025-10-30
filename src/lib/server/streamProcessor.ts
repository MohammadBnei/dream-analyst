import { DreamStatus } from '@prisma/client';
import type { AnalysisStreamChunk } from '$lib/server/n8nService'; // Keeping this for now, but ideally would be a generic StreamChunk
import { getStreamStateStore } from '$lib/server/streamStateStore'; // Renamed import
import { getPrismaClient } from '$lib/server/db';
import { initiateStreamedDreamAnalysis } from '$lib/server/n8nService'; // Keep for the factory function
import type { AisRedis } from '$lib/server/streamStateStore'; // Renamed import

/**
 * Manages the lifecycle of a single stream processing task.
 * This class is responsible for:
 * - Receiving a raw stream of chunks.
 * - Parsing and accumulating chunks.
 * - Persisting intermediate and final states to Redis via StreamStateStore.
 * - Publishing updates to Redis Pub/Sub via StreamStateStore.
 * - Updating the database with final results.
 * - Handling cancellation and errors.
 */
export class StreamProcessor { // Renamed class
    private streamId: string; // Renamed property
    private platform: App.Platform | undefined;
    private streamStateStore: Awaited<ReturnType<typeof getStreamStateStore>>; // Renamed property
    private prisma: Awaited<ReturnType<typeof getPrismaClient>>;

    private accumulatedInterpretation: string = ''; // These fields are still specific to 'analysis', will need to be generalized if truly generic
    private accumulatedTags: string[] = [];
    private resultUpdatedInDb: boolean = false; // Renamed property
    // private isCancelled: boolean = false; // Removed cancellation flag
    private cancellationSubscriber: AisRedis | null = null;
    // private abortController: AbortController; // Removed AbortController

    constructor(streamId: string, platform: App.Platform | undefined) { // Renamed parameter
        this.streamId = streamId;
        this.platform = platform;
        // this.abortController = new AbortController(); // Removed AbortController initialization
    }

    /**
     * Initializes the processor by getting necessary clients.
     * Must be called before `startProcessing`.
     */
    public async init() {
        this.streamStateStore = await getStreamStateStore(); // Renamed function call
        this.prisma = await getPrismaClient();
    }

    /**
     * Starts the background stream processing, consuming the provided ReadableStream.
     * This method should be called once per stream processing task.
     * @param sourceStream The ReadableStream containing the chunks to process.
     */
    public async startProcessing(sourceStream: ReadableStream<Uint8Array>): Promise<void> { // Renamed method and parameter
        if (!this.streamStateStore || !this.prisma) {
            throw new Error('StreamProcessor not initialized. Call init() first.');
        }

        // Removed subscription to cancellation signals

        const decoder = new TextDecoder();
        let jsonBuffer = '';
        const streamId = this.streamId;
        const processChunk = this.processChunk.bind(this); // Bind 'this' for the WritableStream context
        // const signal = this.abortController.signal; // Removed signal

        const backgroundProcessingPromise = sourceStream.pipeTo(new WritableStream({
            // Removed start method with signal listener
            async write(chunk) {
                // Removed signal.aborted check
                
                jsonBuffer += decoder.decode(chunk, { stream: true });

                let boundary = jsonBuffer.indexOf('\n');
                while (boundary !== -1) {
                    const line = jsonBuffer.substring(0, boundary).trim();
                    jsonBuffer = jsonBuffer.substring(boundary + 1);

                    if (line) {
                        try {
                            const parsedChunk: AnalysisStreamChunk = JSON.parse(line);
                            await processChunk(parsedChunk);
                        } catch (e) {
                            console.warn(`Stream ${streamId}: Processor failed to parse stream line or process chunk: ${line}`, e);
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
        })); // Removed signal from WritableStream options

        // Use platform.context.waitUntil if available (e.g., Cloudflare Workers)
        if (this.platform?.context?.waitUntil) {
            this.platform.context.waitUntil(backgroundProcessingPromise.catch(e => {
                // Catch and log errors from the pipeTo promise
                console.error(`Stream ${this.streamId}: Unhandled error in background processing pipeTo:`, e);
            }));
        } else {
            // For Node.js environments, ensure the promise rejection is caught.
            backgroundProcessingPromise.catch(e => {
                console.error(`Stream ${this.streamId}: Unhandled error in background processing pipeTo:`, e);
            });
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
            status: parsedChunk.status || DreamStatus.PENDING_ANALYSIS // Still specific to DreamStatus
        };
        await this.streamStateStore.updateStreamState(this.streamId, redisUpdateChunk, false); // Renamed method
        await this.streamStateStore.publishUpdate(this.streamId, redisUpdateChunk);

        // Database update only on finalStatus or ANALYSIS_FAILED
        if (parsedChunk.finalStatus && !this.resultUpdatedInDb) { // Renamed property
            await this.updateResultInDb(parsedChunk.finalStatus); // Renamed method
            this.resultUpdatedInDb = true;
            console.log(`Stream ${this.streamId}: Processor updated final status to ${parsedChunk.finalStatus} in DB.`);
            await this.streamStateStore.updateStreamState(this.streamId, { finalStatus: parsedChunk.finalStatus }, true); // Update Redis with final status
            await this.streamStateStore.publishUpdate(this.streamId, { finalStatus: parsedChunk.finalStatus }); // Publish final status
        } else if (parsedChunk.status === DreamStatus.ANALYSIS_FAILED && !this.resultUpdatedInDb) { // Still specific to DreamStatus
            await this.updateResultInDb(DreamStatus.ANALYSIS_FAILED); // Renamed method
            this.resultUpdatedInDb = true;
            console.log(`Stream ${this.streamId}: Processor updated final status to ANALYSIS_FAILED (from chunk status) in DB.`);
            await this.streamStateStore.updateStreamState(this.streamId, { finalStatus: DreamStatus.ANALYSIS_FAILED }, true); // Update Redis with final status
            await this.streamStateStore.publishUpdate(this.streamId, { finalStatus: DreamStatus.ANALYSIS_FAILED }); // Publish final status
        }
    }

    private async handleStreamClose(): Promise<void> {
        if (this.cancellationSubscriber) {
            await this.streamStateStore.unsubscribeFromUpdates(this.cancellationSubscriber, this.streamId);
            this.cancellationSubscriber = null; // Clear the subscriber
        }

        // Removed isCancelled check
        if (!this.resultUpdatedInDb) { // Renamed property
            // If the stream closed without an explicit finalStatus and no error was reported, assume completion
            await this.updateResultInDb(DreamStatus.COMPLETED); // Renamed method, still specific to DreamStatus
            console.log(`Stream ${this.streamId}: Processor finished, status set to COMPLETED in DB.`);
            await this.streamStateStore.publishUpdate(this.streamId, { finalStatus: DreamStatus.COMPLETED, message: 'Processing completed.' }); // Publish final status
        }
        await this.streamStateStore.clearStreamState(this.streamId); // Ensure Redis state is cleared on close
    }

    private async handleStreamAbort(reason: any): Promise<void> {
        if (this.cancellationSubscriber) {
            await this.streamStateStore.unsubscribeFromUpdates(this.cancellationSubscriber, this.streamId);
            this.cancellationSubscriber = null; // Clear the subscriber
        }

        const errorMessage = reason instanceof Error ? reason.message : String(reason || 'Unknown error');
        console.error(`Stream ${this.streamId}: Processor aborted:`, errorMessage);

        if (!this.resultUpdatedInDb) { // Renamed property
            await this.updateResultInDb(DreamStatus.ANALYSIS_FAILED); // Renamed method, still specific to DreamStatus
            console.log(`Stream ${this.streamId}: Processor aborted, status set to ANALYSIS_FAILED in DB.`);
            await this.streamStateStore.publishUpdate(this.streamId, { finalStatus: DreamStatus.ANALYSIS_FAILED, message: `Processing aborted: ${errorMessage}` }); // Publish final status
        }
        await this.streamStateStore.clearStreamState(this.streamId); // Ensure Redis state is cleared on abort
    }

    private async updateResultInDb(status: DreamStatus): Promise<void> { // Renamed method, still specific to DreamStatus
        try {
            await this.prisma.dream.update({
                where: { id: this.streamId }, // This is still specific to 'dreamId'
                data: {
                    status: status,
                    interpretation: this.accumulatedInterpretation,
                    tags: this.accumulatedTags
                }
            });
        } catch (updateError) {
            console.error(`Stream ${this.streamId}: Failed to update dream status to ${status} in DB:`, updateError);
        }
    }
}

// A map to keep track of active processors to prevent duplicate background processes
const activeStreamProcessors = new Map<string, StreamProcessor>(); // Renamed map

/**
 * Initiates or retrieves an existing StreamProcessor for a given stream.
 * This factory function is responsible for creating the source stream (e.g., from n8n).
 * @param streamId The ID of the stream.
 * @param rawText The raw text of the stream (specific to dream analysis).
 * @param platform The SvelteKit platform object.
 * @returns The StreamProcessor instance.
 */
export async function getOrCreateStreamProcessor(streamId: string, rawText: string, platform: App.Platform | undefined): Promise<StreamProcessor> { // Renamed function
    if (activeStreamProcessors.has(streamId)) {
        return activeStreamProcessors.get(streamId)!;
    }

    const processor = new StreamProcessor(streamId, platform); // Renamed class
    await processor.init(); // Initialize the processor
    activeStreamProcessors.set(streamId, processor);

    // Create the n8n stream here, without passing an AbortSignal
    const n8nStream = await initiateStreamedDreamAnalysis(streamId, rawText);

    // Start the processing in the background.
    // The processor itself will handle its lifecycle and removal from the map
    // once the processing is truly complete or failed.
    processor.startProcessing(n8nStream).finally(() => { // Renamed method
        // Remove from map once the processing process (including DB updates and Redis cleanup) is done
        activeStreamProcessors.delete(streamId);
    });

    return processor;
}
