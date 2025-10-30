import { error } from '@sveltejs/kit';
import { getPrismaClient } from '$lib/server/db';
import { initiateStreamedDreamAnalysis, type AnalysisStreamChunk } from '$lib/server/n8nService';
import { getAnalysisStore } from '$lib/server/analysisStore';
import Redis from 'ioredis'; // Import Redis for the subscriber client
import { DreamStatus } from '@prisma/client'; // Import the Prisma DreamStatus enum

const encoder = new TextEncoder();

export async function GET({ params, locals, platform, request }) {
    const dreamId = params.id;
    const sessionUser = locals.user;
    const signal = request.signal; // Get the AbortSignal from the request


    if (!sessionUser) {
        throw error(401, 'Unauthorized');
    }

    if (!dreamId) {
        throw error(400, 'Dream ID is required.');
    }

    const analysisStore = await getAnalysisStore();
    const prisma = await getPrismaClient();

    const dream = await prisma.dream.findUnique({
        where: { id: dreamId }
    });

    if (!dream || dream.userId !== sessionUser.id) {
        throw error(403, 'Forbidden: Dream does not belong to user or does not exist.');
    }

    // If analysis is already completed or failed (either in DB or Redis), just return the final result
    if (dream.status === DreamStatus.COMPLETED || dream.status === DreamStatus.ANALYSIS_FAILED) {
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

    // If status is PENDING_ANALYSIS, ensure a background process is running
    if (dream.status === DreamStatus.PENDING_ANALYSIS) {
        // Use Redis to check if analysis is already ongoing and not stalled
        const isOngoing = await analysisStore.isAnalysisOngoing(dreamId);

        if (!isOngoing) {
            console.log(`Dream ${dreamId}: Initiating new background analysis process.`);
            await analysisStore.markAnalysisStarted(dreamId); // Mark as started in Redis
            // Do not await runBackgroundAnalysis here, let it run in the background
            // It will handle its own cleanup (clearing Redis key) on completion/failure.
            runBackgroundAnalysis(dreamId, dream.rawText, platform).catch(e => console.error(`Dream ${dreamId}: Unhandled error in background analysis:`, e));
        } else {
            console.log(`Dream ${dreamId}: Background analysis process already running (tracked by Redis).`);
        }

        // Now, create a stream that subscribes to Redis Pub/Sub for updates
        let subscriberClient: Redis | null = null; // Declare subscriber client here
        let streamClosed = false; // Flag to prevent double closing

        const clientStream = new ReadableStream({
            async start(controller) {
                // Send initial state from Redis (if available) or DB
                const initialRedisState = await analysisStore.getAnalysis(dreamId);
                const initialDream = await prisma.dream.findUnique({
                    where: { id: dreamId },
                    select: { interpretation: true, tags: true, status: true }
                });

                const initialContent = initialRedisState?.interpretation || initialDream?.interpretation || '';
                const initialTags = initialRedisState?.tags || initialDream?.tags || [];
                const initialStatus = initialRedisState?.status || initialDream?.status || DreamStatus.PENDING_ANALYSIS;

                controller.enqueue(encoder.encode(JSON.stringify({
                    content: initialContent,
                    tags: initialTags,
                    status: initialStatus
                }) + '\n'));

                // Subscribe to Redis Pub/Sub for real-time updates
                subscriberClient = analysisStore.subscribeToUpdates(dreamId, (message) => {
                    if (streamClosed) return; // Do nothing if stream is already closed

                    // Check if controller is still readable before enqueueing
                    if (controller.desiredSize === null || controller.desiredSize <= 0) {
                        console.log(`Dream ${dreamId}: Client stream desiredSize <= 0, closing.`);
                        if (subscriberClient) {
                            analysisStore.unsubscribeFromUpdates(subscriberClient, dreamId);
                            subscriberClient = null;
                        }
                        if (!streamClosed) {
                            controller.close();
                            streamClosed = true;
                        }
                        return;
                    }

                    // If the message contains a finalStatus, signal end of stream
                    if (message.finalStatus) {
                        controller.enqueue(encoder.encode(JSON.stringify(message) + '\n'));
                        console.log(`Dream ${dreamId}: Client stream ending due to finalStatus: ${message.finalStatus}`);
                        if (subscriberClient) {
                            analysisStore.unsubscribeFromUpdates(subscriberClient, dreamId);
                            subscriberClient = null;
                        }
                        if (!streamClosed) {
                            controller.close();
                            streamClosed = true;
                        }
                    } else {
                        // Otherwise, enqueue the update
                        controller.enqueue(encoder.encode(JSON.stringify(message) + '\n'));
                    }
                });

                // Cleanup on client disconnect (HTTP connection aborts)
                signal.addEventListener('abort', async () => {
                    console.log(`Dream ${dreamId}: Client disconnected from stream (HTTP abort).`);
                    if (subscriberClient) {
                        await analysisStore.unsubscribeFromUpdates(subscriberClient, dreamId);
                        subscriberClient = null;
                    }
                    if (!streamClosed) {
                        controller.close(); // Ensure controller is closed
                        streamClosed = true;
                    }
                });
            },
            async cancel() {
                console.log(`Dream ${dreamId}: Client stream cancelled (ReadableStream cancel).`);
                if (subscriberClient) {
                    await analysisStore.unsubscribeFromUpdates(subscriberClient, dreamId);
                    subscriberClient = null;
                }
                // Mark as closed to prevent further actions, but don't call controller.close() here
                // as the stream is already being cancelled.
                streamClosed = true;
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

// Background function to run the n8n analysis and update Redis and the database
async function runBackgroundAnalysis(dreamId: string, rawText: string, platform: App.Platform | undefined) {
    const decoder = new TextDecoder();
    let jsonBuffer = '';
    let dreamStatusUpdatedInDb = false; // Track if final status was updated in DB
    let accumulatedInterpretation = '';
    let accumulatedTags: string[] = [];
    let isCancelled = false; // Flag to track if analysis was cancelled

    const analysisStore = await getAnalysisStore();
    const prisma = await getPrismaClient();

    // Subscribe to the dream's channel to listen for cancellation signals
    const cancellationSubscriber = analysisStore.subscribeToUpdates(dreamId, (message) => {
        if (message.finalStatus === DreamStatus.ANALYSIS_FAILED && message.message === 'Analysis cancelled by user.') {
            console.log(`Dream ${dreamId}: Background process received cancellation signal.`);
            isCancelled = true;
        }
    });

    try {
        const n8nStream = await initiateStreamedDreamAnalysis(dreamId, rawText);

        const backgroundProcessingPromise = n8nStream.pipeTo(new WritableStream({
            async write(chunk) {
                if (isCancelled) {
                    console.log(`Dream ${dreamId}: Background process stopping write due to cancellation.`);
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

                            // Accumulate interpretation and tags in memory
                            if (parsedChunk.content) {
                                accumulatedInterpretation += parsedChunk.content;
                            }
                            if (parsedChunk.tags) {
                                accumulatedTags = parsedChunk.tags;
                            }

                            // Update Redis with current progress and publish
                            const redisUpdateChunk: AnalysisStreamChunk = {
                                content: parsedChunk.content, // Send delta content
                                tags: parsedChunk.tags,
                                status: parsedChunk.status || DreamStatus.PENDING_ANALYSIS
                            };
                            await analysisStore.updateAnalysis(dreamId, redisUpdateChunk, false);
                            await analysisStore.publishUpdate(dreamId, redisUpdateChunk);


                            // Database update only on finalStatus or ANALYSIS_FAILED
                            if (parsedChunk.finalStatus && !dreamStatusUpdatedInDb) {
                                await prisma.dream.update({
                                    where: { id: dreamId },
                                    data: {
                                        status: parsedChunk.finalStatus,
                                        interpretation: accumulatedInterpretation,
                                        tags: accumulatedTags
                                    }
                                }).catch(updateError => console.error(`Dream ${dreamId}: Failed to update final status in DB:`, updateError));
                                dreamStatusUpdatedInDb = true;
                                console.log(`Dream ${dreamId}: Background process updated final status to ${parsedChunk.finalStatus} in DB.`);
                                await analysisStore.updateAnalysis(dreamId, { finalStatus: parsedChunk.finalStatus }, true); // Update Redis with final status
                                await analysisStore.publishUpdate(dreamId, { finalStatus: parsedChunk.finalStatus }); // Publish final status
                            } else if (parsedChunk.status === DreamStatus.ANALYSIS_FAILED && !dreamStatusUpdatedInDb) {
                                await prisma.dream.update({
                                    where: { id: dreamId },
                                    data: {
                                        status: DreamStatus.ANALYSIS_FAILED,
                                        interpretation: accumulatedInterpretation,
                                        tags: accumulatedTags
                                    }
                                }).catch(updateError => console.error(`Dream ${dreamId}: Failed to update final status in DB:`, updateError));
                                dreamStatusUpdatedInDb = true;
                                console.log(`Dream ${dreamId}: Background process updated final status to ANALYSIS_FAILED (from chunk status) in DB.`);
                                await analysisStore.updateAnalysis(dreamId, { finalStatus: DreamStatus.ANALYSIS_FAILED }, true); // Update Redis with final status
                                await analysisStore.publishUpdate(dreamId, { finalStatus: DreamStatus.ANALYSIS_FAILED }); // Publish final status
                            }

                        } catch (e) {
                            console.warn(`Dream ${dreamId}: Background process failed to parse n8nService stream line or process chunk: ${line}`, e);
                        }
                    }
                    boundary = jsonBuffer.indexOf('\n');
                }
            },
            async close() {
                // Unsubscribe from cancellation channel
                await analysisStore.unsubscribeFromUpdates(cancellationSubscriber, dreamId);

                // If cancelled, the status should already be ANALYSIS_FAILED
                if (isCancelled) {
                    console.log(`Dream ${dreamId}: Background process closed after cancellation.`);
                    // The DB status should have been updated by the DELETE endpoint or the abort handler
                    await analysisStore.clearAnalysis(dreamId); // Clear from Redis
                    return;
                }

                // If the stream closed without an explicit finalStatus and no error was reported, assume completion
                if (!dreamStatusUpdatedInDb) {
                    await prisma.dream.update({
                        where: { id: dreamId },
                        data: {
                            status: DreamStatus.COMPLETED, // Explicitly set to COMPLETED
                            interpretation: accumulatedInterpretation,
                            tags: accumulatedTags
                        }
                    }).catch(updateError => console.error(`Dream ${dreamId}: Failed to update status to COMPLETED in DB:`, updateError));
                    console.log(`Dream ${dreamId}: Background process finished, status set to COMPLETED in DB.`);
                    await analysisStore.publishUpdate(dreamId, { finalStatus: DreamStatus.COMPLETED, message: 'Analysis completed.' }); // Publish final status
                }
                await analysisStore.clearAnalysis(dreamId); // Clear from Redis once fully processed
            },
            async abort(reason) {
                // Unsubscribe from cancellation channel
                await analysisStore.unsubscribeFromUpdates(cancellationSubscriber, dreamId);

                const errorMessage = reason instanceof Error ? reason.message : String(reason || 'Unknown error');
                console.error(`Dream ${dreamId}: Background process aborted:`, errorMessage);
                if (!dreamStatusUpdatedInDb) {
                    await prisma.dream.update({
                        where: { id: dreamId },
                        data: {
                            status: DreamStatus.ANALYSIS_FAILED, // Explicitly set to ANALYSIS_FAILED
                            interpretation: accumulatedInterpretation,
                            tags: accumulatedTags
                        }
                    }).catch(updateError => console.error(`Dream ${dreamId}: Failed to update status to ANALYSIS_FAILED in DB:`, updateError));
                    dreamStatusUpdatedInDb = true;
                    console.log(`Dream ${dreamId}: Background process aborted, status set to ANALYSIS_FAILED in DB.`);
                    await analysisStore.publishUpdate(dreamId, { finalStatus: DreamStatus.ANALYSIS_FAILED, message: `Analysis aborted: ${errorMessage}` }); // Publish final status
                }
                await analysisStore.clearAnalysis(dreamId); // Clear from Redis on abort
            }
        }));

        // Use platform.context.waitUntil if available (e.g., Cloudflare Workers)
        // to ensure the background task completes even after the HTTP response is sent.
        if (platform?.context?.waitUntil) {
            platform.context.waitUntil(backgroundProcessingPromise);
        } else {
            // For Node.js environments, just await it or let it run in the background.
            // If not awaited, ensure proper error logging for unhandled rejections.
            backgroundProcessingPromise.catch(e => {
                // Only log if it's not the expected cancellation error
                if (e.message !== 'Analysis cancelled by user.') {
                    console.error(`Dream ${dreamId}: Unhandled error in background analysis pipeTo:`, e);
                } else {
                    console.log(`Dream ${dreamId}: Background analysis pipeTo aborted by user cancellation.`);
                }
            });
        }

    } catch (e) {
        // Unsubscribe from cancellation channel in case of early error
        await analysisStore.unsubscribeFromUpdates(cancellationSubscriber, dreamId);

        console.error(`Dream ${dreamId}: Error initiating background n8n stream:`, e);
        if (!dreamStatusUpdatedInDb) {
            await prisma.dream.update({
                where: { id: dreamId },
                data: { status: DreamStatus.ANALYSIS_FAILED } // Explicitly set to ANALYSIS_FAILED
            }).catch(updateError => console.error(`Dream ${dreamId}: Failed to update status to ANALYSIS_FAILED after n8n initiation error:`, updateError));
            await analysisStore.publishUpdate(dreamId, { finalStatus: DreamStatus.ANALYSIS_FAILED, message: `Failed to initiate analysis: ${e instanceof Error ? e.message : String(e)}` }); // Publish final status
        }
        await analysisStore.clearAnalysis(dreamId); // Clear from Redis on initiation error
    }
}
