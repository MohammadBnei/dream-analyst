import { error } from '@sveltejs/kit';
import { getPrismaClient } from '$lib/server/db';
import type { AnalysisStreamChunk } from '$lib/server/n8nService';
import { getAnalysisStore } from '$lib/server/analysisStore';
import { getOrCreateAnalysisStreamManager } from '$lib/server/analysisStreamManager';
import { DreamStatus } from '@prisma/client';
import type Redis from 'ioredis'; // Import Redis for the subscriber client type

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
            console.log(`Dream ${dreamId}: Initiating new background analysis process via AnalysisStreamManager.`);
            await analysisStore.markAnalysisStarted(dreamId); // Mark as started in Redis
            // Get or create the manager. It will start the analysis in the background.
            getOrCreateAnalysisStreamManager(dreamId, dream.rawText, platform);
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
                    // desiredSize can be null (unlimited) or > 0 for space
                    if (controller.desiredSize !== null && controller.desiredSize <= 0) {
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
