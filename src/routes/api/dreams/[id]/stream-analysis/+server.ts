// src/routes/api/dreams/[id]/stream-analysis/+server.ts
import { error } from '@sveltejs/kit';
import { initiateStreamedDreamAnalysis, type AnalysisStreamChunk } from '$lib/server/n8nService';
import prisma from '$lib/server/db';

// In-memory map to track ongoing analysis processes.
// IMPORTANT: This will only work for single-instance deployments.
// For multi-instance, consider a distributed cache (e.g., Redis) or rely solely on DB status.
const ongoingAnalysisProcesses = new Map<string, Promise<void>>();

export async function GET({ params, locals, platform }) {
    const dreamId = params.id;
    const sessionUser = locals.user;

    if (!sessionUser) {
        throw error(401, 'Unauthorized');
    }

    if (!dreamId) {
        throw error(400, 'Dream ID is required.');
    }

    const dream = await prisma.dream.findUnique({
        where: { id: dreamId }
    });

    if (!dream || dream.userId !== sessionUser.id) {
        throw error(403, 'Forbidden: Dream does not belong to user or does not exist.');
    }

    // If analysis is already completed or failed, just return the final result
    if (dream.status === 'completed' || dream.status === 'analysis_failed') {
        const finalChunk: AnalysisStreamChunk = {
            content: dream.interpretation || '',
            tags: dream.tags || [],
            status: dream.status,
            finalStatus: dream.status
        };
        return new Response(JSON.stringify(finalChunk) + '\n', {
            headers: {
                'Content-Type': 'application/x-ndjson',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        });
    }

    // If status is pending_analysis, ensure a background process is running
    if (dream.status === 'pending_analysis') {
        if (!ongoingAnalysisProcesses.has(dreamId)) {
            console.log(`Dream ${dreamId}: Initiating new background analysis process.`);
            const analysisPromise = runBackgroundAnalysis(dreamId, dream.rawText, platform);
            ongoingAnalysisProcesses.set(dreamId, analysisPromise);
            analysisPromise.finally(() => {
                ongoingAnalysisProcesses.delete(dreamId);
                console.log(`Dream ${dreamId}: Background analysis process finished/removed.`);
            });
        } else {
            console.log(`Dream ${dreamId}: Background analysis process already running.`);
        }

        // Now, create a stream that sends updates from the database to the client
        const encoder = new TextEncoder();
        let lastInterpretation = dream.interpretation || '';
        let lastTags = dream.tags || [];
        let lastStatus = dream.status;

        const clientStream = new ReadableStream({
            async start(controller) {
                // Send initial state
                controller.enqueue(encoder.encode(JSON.stringify({
                    content: lastInterpretation,
                    tags: lastTags,
                    status: lastStatus
                }) + '\n'));

                // Poll for updates
                const intervalId = setInterval(async () => {
                    const currentDream = await prisma.dream.findUnique({
                        where: { id: dreamId },
                        select: { interpretation: true, tags: true, status: true }
                    });

                    if (!currentDream) {
                        console.warn(`Dream ${dreamId}: Not found during client stream polling.`);
                        controller.enqueue(encoder.encode(JSON.stringify({ message: 'Dream not found.', finalStatus: 'analysis_failed' }) + '\n'));
                        clearInterval(intervalId);
                        controller.close();
                        return;
                    }

                    let hasUpdate = false;
                    const chunk: AnalysisStreamChunk = {};

                    if (currentDream.interpretation && currentDream.interpretation !== lastInterpretation) {
                        // Only send the *new* part of the interpretation
                        const newContent = currentDream.interpretation.substring(lastInterpretation.length);
                        if (newContent) {
                            chunk.content = newContent;
                            lastInterpretation = currentDream.interpretation;
                            hasUpdate = true;
                        }
                    }
                    if (currentDream.tags && JSON.stringify(currentDream.tags) !== JSON.stringify(lastTags)) {
                        chunk.tags = currentDream.tags;
                        lastTags = currentDream.tags;
                        hasUpdate = true;
                    }
                    if (currentDream.status !== lastStatus) {
                        chunk.status = currentDream.status;
                        lastStatus = currentDream.status;
                        hasUpdate = true;
                    }

                    if (hasUpdate) {
                        controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'));
                    }

                    if (currentDream.status === 'completed' || currentDream.status === 'analysis_failed') {
                        console.log(`Dream ${dreamId}: Client stream ending due to final status: ${currentDream.status}`);
                        controller.enqueue(encoder.encode(JSON.stringify({ finalStatus: currentDream.status }) + '\n'));
                        clearInterval(intervalId);
                        controller.close();
                    }
                }, 1000); // Poll every 1 second

                // Cleanup on client disconnect
                platform?.context?.waitUntil(new Promise<void>(resolve => {
                    controller.signal.addEventListener('abort', () => {
                        console.log(`Dream ${dreamId}: Client disconnected from stream.`);
                        clearInterval(intervalId);
                        resolve();
                    });
                }));
            },
            cancel() {
                console.log(`Dream ${dreamId}: Client stream cancelled.`);
            }
        });

        return new Response(clientStream, {
            headers: {
                'Content-Type': 'application/x-ndjson',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        });
    }

    // Should not be reached if initial checks are comprehensive
    throw error(500, 'Unexpected dream status or logic flow.');
}

// Background function to run the n8n analysis and update the database
async function runBackgroundAnalysis(dreamId: string, rawText: string, platform: App.Platform | undefined) {
    const decoder = new TextDecoder();
    let jsonBuffer = '';
    let dreamStatusUpdated = false;
    let accumulatedInterpretation = '';
    let accumulatedTags: string[] = [];

    try {
        const n8nStream = await initiateStreamedDreamAnalysis(dreamId, rawText);

        const backgroundProcessingPromise = n8nStream.pipeTo(new WritableStream({
            async write(chunk) {
                jsonBuffer += decoder.decode(chunk, { stream: true });

                let boundary = jsonBuffer.indexOf('\n');
                while (boundary !== -1) {
                    const line = jsonBuffer.substring(0, boundary).trim();
                    jsonBuffer = jsonBuffer.substring(boundary + 1);

                    if (line) {
                        try {
                            const parsedChunk: AnalysisStreamChunk = JSON.parse(line);

                            // Accumulate interpretation and tags
                            if (parsedChunk.content) {
                                accumulatedInterpretation += parsedChunk.content;
                            }
                            if (parsedChunk.tags) {
                                accumulatedTags = parsedChunk.tags;
                            }

                            // Update database with current progress
                            await prisma.dream.update({
                                where: { id: dreamId },
                                data: {
                                    interpretation: accumulatedInterpretation,
                                    tags: accumulatedTags,
                                    status: parsedChunk.status || 'pending_analysis' // Update status if provided by n8nService
                                }
                            }).catch(updateError => console.error(`Dream ${dreamId}: Failed to update progress in DB:`, updateError));

                            // Check for final status signals from n8nService
                            if (parsedChunk.finalStatus && !dreamStatusUpdated) {
                                await prisma.dream.update({
                                    where: { id: dreamId },
                                    data: {
                                        status: parsedChunk.finalStatus,
                                        interpretation: accumulatedInterpretation,
                                        tags: accumulatedTags
                                    }
                                }).catch(updateError => console.error(`Dream ${dreamId}: Failed to update final status in DB:`, updateError));
                                dreamStatusUpdated = true;
                                console.log(`Dream ${dreamId}: Background process updated final status to ${parsedChunk.finalStatus}`);
                            }

                        } catch (e) {
                            console.warn(`Dream ${dreamId}: Background process failed to parse n8nService stream line or process chunk: ${line}`, e);
                        }
                    }
                    boundary = jsonBuffer.indexOf('\n');
                }
            },
            async close() {
                // Process any remaining content in the buffer
                if (jsonBuffer.trim()) {
                    try {
                        const parsedChunk: AnalysisStreamChunk = JSON.parse(jsonBuffer.trim());
                        if (parsedChunk.finalStatus && !dreamStatusUpdated) {
                            await prisma.dream.update({
                                where: { id: dreamId },
                                data: {
                                    status: parsedChunk.finalStatus,
                                    interpretation: accumulatedInterpretation,
                                    tags: accumulatedTags
                                }
                            }).catch(updateError => console.error(`Dream ${dreamId}: Failed to update final status in DB (from final buffer):`, updateError));
                            dreamStatusUpdated = true;
                            console.log(`Dream ${dreamId}: Background process updated final status to ${parsedChunk.finalStatus} (from final buffer)`);
                        }
                    } catch (e) {
                        console.warn(`Dream ${dreamId}: Background process failed to parse final n8nService stream buffer as JSON: ${jsonBuffer.trim()}`, e);
                    }
                }

                // If the stream closed without an explicit finalStatus and no error was reported, assume completion
                if (!dreamStatusUpdated) {
                    await prisma.dream.update({
                        where: { id: dreamId },
                        data: {
                            status: 'completed',
                            interpretation: accumulatedInterpretation,
                            tags: accumulatedTags
                        }
                    }).catch(updateError => console.error(`Dream ${dreamId}: Failed to update status to completed in DB:`, updateError));
                    console.log(`Dream ${dreamId}: Background process finished, status set to completed.`);
                }
            },
            async abort(reason) {
                const errorMessage = reason instanceof Error ? reason.message : String(reason || 'Unknown error');
                console.error(`Dream ${dreamId}: Background process aborted:`, errorMessage);
                if (!dreamStatusUpdated) {
                    await prisma.dream.update({
                        where: { id: dreamId },
                        data: {
                            status: 'analysis_failed',
                            interpretation: accumulatedInterpretation,
                            tags: accumulatedTags
                        }
                    }).catch(updateError => console.error(`Dream ${dreamId}: Failed to update status to analysis_failed in DB:`, updateError));
                    dreamStatusUpdated = true;
                    console.log(`Dream ${dreamId}: Background process aborted, status set to analysis_failed.`);
                }
            }
        }));

        // Use platform.context.waitUntil if available (e.g., Cloudflare Workers)
        // to ensure the background task completes even after the HTTP response is sent.
        if (platform?.context?.waitUntil) {
            platform.context.waitUntil(backgroundProcessingPromise);
        } else {
            // For Node.js environments, just await it or let it run in the background.
            // If not awaited, ensure proper error logging for unhandled rejections.
            backgroundProcessingPromise.catch(e => console.error(`Dream ${dreamId}: Unhandled error in background analysis pipeTo:`, e));
        }

    } catch (e) {
        console.error(`Dream ${dreamId}: Error initiating background n8n stream:`, e);
        if (!dreamStatusUpdated) {
            await prisma.dream.update({
                where: { id: dreamId },
                data: { status: 'analysis_failed' }
            }).catch(updateError => console.error(`Dream ${dreamId}: Failed to update status to analysis_failed after n8n initiation error:`, updateError));
        }
    }
}
