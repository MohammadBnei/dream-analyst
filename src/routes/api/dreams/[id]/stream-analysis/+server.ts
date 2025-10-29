// src/routes/api/dreams/[id]/stream-analysis/+server.ts
import { error } from '@sveltejs/kit';
import { initiateStreamedDreamAnalysis, type AnalysisStreamChunk } from '$lib/server/n8nService';
import prisma from '$lib/server/db';
import { analysisStore } from '$lib/server/analysisStore'; // Import the new analysis store

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

    // Check Redis for ongoing analysis state first
    const redisAnalysisState = await analysisStore.getAnalysis(dreamId);

    console.log({ redisAnalysisState })

    // If analysis is already completed or failed (either in DB or Redis), just return the final result
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
        // Use Redis to check if analysis is already ongoing
        const isOngoing = await analysisStore.isAnalysisOngoing(dreamId);

        if (!isOngoing) {
            console.log(`Dream ${dreamId}: Initiating new background analysis process.`);
            await analysisStore.markAnalysisStarted(dreamId); // Mark as started in Redis
            const analysisPromise = runBackgroundAnalysis(dreamId, dream.rawText, platform);
            // We don't need to store the promise in an in-memory map anymore, Redis handles the "ongoing" state.
            // The promise will handle its own cleanup (clearing Redis key) on completion/failure.
        } else {
            console.log(`Dream ${dreamId}: Background analysis process already running (tracked by Redis).`);
        }

        // Now, create a stream that sends updates from Redis to the client
        const encoder = new TextEncoder();
        let lastInterpretation = redisAnalysisState?.interpretation || dream.interpretation || '';
        let lastTags = redisAnalysisState?.tags || dream.tags || [];
        let lastStatus = redisAnalysisState?.status || dream.status;

        const clientStream = new ReadableStream({
            async start(controller) {
                // Send initial state (from Redis if available, otherwise from DB)
                controller.enqueue(encoder.encode(JSON.stringify({
                    content: lastInterpretation,
                    tags: lastTags,
                    status: lastStatus
                }) + '\n'));

                let intervalId: ReturnType<typeof setInterval> | null = setInterval(async () => {
                    // Safeguard: Check if the controller is still active before enqueuing
                    // If desiredSize is 0 or less, the consumer is no longer reading, so close the stream.
                    if (!controller.desiredSize || controller.desiredSize <= 0) {
                        console.log('controller closed')
                        if (intervalId) {
                            clearInterval(intervalId);
                            intervalId = null;
                        }
                        return;
                    }

                    const currentRedisState = await analysisStore.getAnalysis(dreamId);
                    const currentDbDream = await prisma.dream.findUnique({
                        where: { id: dreamId },
                        select: { interpretation: true, tags: true, status: true }
                    });

                    const effectiveStatus = currentRedisState?.status || currentDbDream?.status || 'pending_analysis';
                    const effectiveInterpretation = currentRedisState?.interpretation || currentDbDream?.interpretation || '';
                    const effectiveTags = currentRedisState?.tags || currentDbDream?.tags || [];

                    let hasUpdate = false;
                    const chunk: AnalysisStreamChunk = {};

                    // Send full interpretation if it changed (from Redis or DB)
                    if (effectiveInterpretation !== lastInterpretation) {
                        chunk.content = effectiveInterpretation;
                        lastInterpretation = effectiveInterpretation;
                        hasUpdate = true;
                    }
                    if (JSON.stringify(effectiveTags) !== JSON.stringify(lastTags)) {
                        chunk.tags = effectiveTags;
                        lastTags = effectiveTags;
                        hasUpdate = true;
                    }
                    if (effectiveStatus !== lastStatus) {
                        chunk.status = effectiveStatus;
                        lastStatus = effectiveStatus;
                        hasUpdate = true;
                    }

                    if (hasUpdate) {
                        controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'));
                    }

                    if (effectiveStatus === 'completed' || effectiveStatus === 'analysis_failed') {
                        console.log(`Dream ${dreamId}: Client stream ending due to final status: ${effectiveStatus}`);
                        controller.enqueue(encoder.encode(JSON.stringify({ finalStatus: effectiveStatus }) + '\n'));
                        clearInterval(intervalId);
                        intervalId = null; // Mark interval as cleared
                        controller.close();
                    }
                }, 1000); // Poll every 1 second

                // Cleanup on client disconnect
                signal.addEventListener('abort', () => {
                    console.log(`Dream ${dreamId}: Client disconnected from stream.`);
                    if (intervalId) {
                        clearInterval(intervalId);
                        intervalId = null; // Mark interval as cleared
                    }
                    controller.close(); // Ensure controller is closed
                });
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

// Background function to run the n8n analysis and update Redis and the database
async function runBackgroundAnalysis(dreamId: string, rawText: string, platform: App.Platform | undefined) {
    const decoder = new TextDecoder();
    let jsonBuffer = '';
    let dreamStatusUpdatedInDb = false; // Track if final status was updated in DB
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

                            // Accumulate interpretation and tags in memory
                            if (parsedChunk.content) {
                                accumulatedInterpretation += parsedChunk.content;
                            }
                            if (parsedChunk.tags) {
                                accumulatedTags = parsedChunk.tags;
                            }

                            // Update Redis with current progress
                            await analysisStore.updateAnalysis(dreamId, {
                                content: parsedChunk.content,
                                tags: parsedChunk.tags,
                                status: parsedChunk.status || 'pending_analysis'
                            });

                            // Database update only on finalStatus or analysis_failed
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
                            } else if (parsedChunk.status === 'analysis_failed' && !dreamStatusUpdatedInDb) {
                                await prisma.dream.update({
                                    where: { id: dreamId },
                                    data: {
                                        status: 'analysis_failed',
                                        interpretation: accumulatedInterpretation,
                                        tags: accumulatedTags
                                    }
                                }).catch(updateError => console.error(`Dream ${dreamId}: Failed to update final status in DB:`, updateError));
                                dreamStatusUpdatedInDb = true;
                                console.log(`Dream ${dreamId}: Background process updated final status to analysis_failed (from chunk status) in DB.`);
                                await analysisStore.updateAnalysis(dreamId, { finalStatus: 'analysis_failed' }, true); // Update Redis with final status
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
                        if (parsedChunk.finalStatus && !dreamStatusUpdatedInDb) {
                            await prisma.dream.update({
                                where: { id: dreamId },
                                data: {
                                    status: parsedChunk.finalStatus,
                                    interpretation: accumulatedInterpretation,
                                    tags: accumulatedTags
                                }
                            }).catch(updateError => console.error(`Dream ${dreamId}: Failed to update final status in DB (from final buffer):`, updateError));
                            dreamStatusUpdatedInDb = true;
                            console.log(`Dream ${dreamId}: Background process updated final status to ${parsedChunk.finalStatus} (from final buffer) in DB.`);
                            await analysisStore.updateAnalysis(dreamId, { finalStatus: parsedChunk.finalStatus }, true); // Update Redis with final status
                        }
                    } catch (e) {
                        console.warn(`Dream ${dreamId}: Background process failed to parse final n8nService stream buffer as JSON: ${jsonBuffer.trim()}`, e);
                    }
                }

                // If the stream closed without an explicit finalStatus and no error was reported, assume completion
                if (!dreamStatusUpdatedInDb) {
                    await prisma.dream.update({
                        where: { id: dreamId },
                        data: {
                            status: 'completed',
                            interpretation: accumulatedInterpretation,
                            tags: accumulatedTags
                        }
                    }).catch(updateError => console.error(`Dream ${dreamId}: Failed to update status to completed in DB:`, updateError));
                    console.log(`Dream ${dreamId}: Background process finished, status set to completed in DB.`);
                    await analysisStore.updateAnalysis(dreamId, { finalStatus: 'completed' }, true); // Update Redis with final status
                }
                await analysisStore.clearAnalysis(dreamId); // Clear from Redis once fully processed
            },
            async abort(reason) {
                const errorMessage = reason instanceof Error ? reason.message : String(reason || 'Unknown error');
                console.error(`Dream ${dreamId}: Background process aborted:`, errorMessage);
                if (!dreamStatusUpdatedInDb) {
                    await prisma.dream.update({
                        where: { id: dreamId },
                        data: {
                            status: 'analysis_failed',
                            interpretation: accumulatedInterpretation,
                            tags: accumulatedTags
                        }
                    }).catch(updateError => console.error(`Dream ${dreamId}: Failed to update status to analysis_failed in DB:`, updateError));
                    dreamStatusUpdatedInDb = true;
                    console.log(`Dream ${dreamId}: Background process aborted, status set to analysis_failed in DB.`);
                    await analysisStore.updateAnalysis(dreamId, { finalStatus: 'analysis_failed' }, true); // Update Redis with final status
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
            backgroundProcessingPromise.catch(e => console.error(`Dream ${dreamId}: Unhandled error in background analysis pipeTo:`, e));
        }

    } catch (e) {
        console.error(`Dream ${dreamId}: Error initiating background n8n stream:`, e);
        if (!dreamStatusUpdatedInDb) {
            await prisma.dream.update({
                where: { id: dreamId },
                data: { status: 'analysis_failed' }
            }).catch(updateError => console.error(`Dream ${dreamId}: Failed to update status to analysis_failed after n8n initiation error:`, updateError));
            await analysisStore.updateAnalysis(dreamId, { finalStatus: 'analysis_failed' }, true); // Update Redis with final status
        }
        await analysisStore.clearAnalysis(dreamId); // Clear from Redis on initiation error
    }
}
