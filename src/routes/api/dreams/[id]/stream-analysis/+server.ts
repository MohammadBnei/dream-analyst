import { error } from '@sveltejs/kit';
import { getPrismaClient } from '$lib/server/db';
import type { AnalysisStreamChunk } from '$lib/server/n8nService';
import { getStreamStateStore } from '$lib/server/streamStateStore'; // Renamed import
import { getOrCreateStreamProcessor } from '$lib/server/streamProcessor'; // Renamed import
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

    const streamStateStore = await getStreamStateStore(); // Renamed function call
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
        // Use Redis to check if stream is already ongoing and not stalled
        const isOngoing = await streamStateStore.isStreamOngoing(dreamId); // Renamed method

        if (!isOngoing) {
            console.log(`Dream ${dreamId}: Initiating new background stream processing via StreamProcessor.`);
            await streamStateStore.markStreamStarted(dreamId); // Renamed method // Mark as started in Redis
            // Get or create the processor. It will start the processing in the background.
            // The rawText is passed here because this is where the n8n-specific stream is initiated.
            getOrCreateStreamProcessor(dreamId, dream.rawText, platform); // Renamed function call
        } else {
            console.log(`Dream ${dreamId}: Background stream processing already running (tracked by Redis).`);
        }

        // Now, create a stream that subscribes to Redis Pub/Sub for updates
        let subscriberClient: Redis | null = null; // Declare subscriber client here
        let streamClosed = false; // Flag to prevent double closing

        const clientStream = new ReadableStream({
            async start(controller) {
                // Send initial state from Redis (if available) or DB
                const initialRedisState = await streamStateStore.getStreamState(dreamId); // Renamed method
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
                subscriberClient = streamStateStore.subscribeToUpdates(dreamId, (message) => {
                    if (streamClosed) return; // Do nothing if stream is already closed

                    // Check if controller is still readable before enqueueing
                    // desiredSize can be null (unlimited) or > 0 for space
                    if (controller.desiredSize !== null && controller.desiredSize <= 0) {
                        console.log(`Dream ${dreamId}: Client stream desiredSize <= 0, closing.`);
                        if (subscriberClient) {
                            streamStateStore.unsubscribeFromUpdates(subscriberClient, dreamId);
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
                            streamStateStore.unsubscribeFromUpdates(subscriberClient, dreamId);
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
                        await streamStateStore.unsubscribeFromUpdates(subscriberClient, dreamId);
                        subscriberClient = null;
                    }
                    if (!streamClosed) {
                        controller.close(); // Ensure controller is closed
                        streamClosed = true;
                    }
                    // Publish a cancellation signal to the StreamProcessor
                    await streamStateStore.publishCancellation(dreamId);
                });
            },
            async cancel() {
                console.log(`Dream ${dreamId}: Client stream cancelled (ReadableStream cancel).`);
                if (subscriberClient) {
                    await streamStateStore.unsubscribeFromUpdates(subscriberClient, dreamId);
                    subscriberClient = null;
                }
                // Mark as closed to prevent further actions, but don't call controller.close() here
                // as the stream is already being cancelled.
                streamClosed = true;
                // Publish a cancellation signal to the StreamProcessor
                await streamStateStore.publishCancellation(dreamId);
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
