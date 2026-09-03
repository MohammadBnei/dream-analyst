import { error } from '@sveltejs/kit';
import { getPrismaClient } from '$lib/server/db';
import { getStreamStateStore } from '$lib/server/streamStateStore';
import { getOrCreateStreamProcessor } from '$lib/server/streamProcessor';
import { DreamStatus } from '@prisma/client';
import type Redis from 'ioredis';
import { DREAM_PROMPT_TYPES, type DreamPromptType } from '$lib/prompts/dreamAnalyst';
import { requireOwnedDream } from '$lib/server/guards';

const encoder = new TextEncoder();

export async function GET({ params, locals, platform, request }) {
	const dreamId = params.id;
	if (!dreamId) error(400, 'Dream ID is required.');

	const dream = await requireOwnedDream(locals, dreamId);

	const streamStateStore = await getStreamStateStore();
	const prisma = getPrismaClient();
	// NOTE: no credit check happens here. Analysis triggered directly through this
	// endpoint is currently uncharged; charging is added with the credit work.

	// Was cast straight from the query string, so an unknown value reached
	// promptService.getSystemPrompt() and threw inside stream setup.
	const requestedPromptType = new URL(request.url).searchParams.get('promptType');
	const promptType: DreamPromptType = DREAM_PROMPT_TYPES.includes(
		requestedPromptType as DreamPromptType
	)
		? (requestedPromptType as DreamPromptType)
		: 'jungian';

	// If analysis is already completed or failed (either in DB or Redis), just return the final result
	if (dream.status === DreamStatus.COMPLETED || dream.status === DreamStatus.ANALYSIS_FAILED) {
		const finalChunk: App.AnalysisStreamChunk = {
			content: dream.interpretation || '',
			tags: (dream.tags as string[]) || [], // Cast Json? to string[]
			status: dream.status,
			finalStatus: dream.status === DreamStatus.COMPLETED ? 'COMPLETED' : 'ANALYSIS_FAILED'
		};
		return new Response(JSON.stringify(finalChunk) + '\n', {
			headers: {
				'Content-Type': 'application/x-ndjson',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive'
			}
		});
	}

	// If status is PENDING_ANALYSIS, ensure a background process is running
	if (dream.status === DreamStatus.PENDING_ANALYSIS) {
		// Use Redis to check if stream is already ongoing and not stalled
		const isOngoing = await streamStateStore.isStreamOngoing(dreamId);

		if (!isOngoing) {
			console.debug(
				`Dream ${dreamId}: Initiating new background stream processing via StreamProcessor.`
			);
			await streamStateStore.markStreamStarted(dreamId, promptType); // Mark as started in Redis with promptType
			// Get or create the processor. It will start the processing in the background.
			// IMPORTANT: Removed request.signal here to prevent server-side abortion on client disconnect.
			getOrCreateStreamProcessor(dream, platform, promptType); // Pass promptType
		} else {
			console.debug(
				`Dream ${dreamId}: Background stream processing already running (tracked by Redis).`
			);
		}

		// Now, create a stream that subscribes to Redis Pub/Sub for updates
		let subscriberClient: Redis | null = null;
		let streamClosed = false;

		const clientStream = new ReadableStream({
			async start(controller) {
				// Send initial state from Redis (if available) or DB
				const initialRedisState = await streamStateStore.getStreamState(dreamId);
				const initialDream = await prisma.dream.findUnique({
					where: { id: dreamId },
					select: { interpretation: true, tags: true, status: true }
				});

				const initialContent =
					initialRedisState?.interpretation || initialDream?.interpretation || '';
				const initialTags =
					(initialRedisState?.tags as string[]) || (initialDream?.tags as string[]) || [];
				const initialStatus =
					initialRedisState?.status || initialDream?.status || DreamStatus.PENDING_ANALYSIS;

				controller.enqueue(
					encoder.encode(
						JSON.stringify({
							content: initialContent,
							tags: initialTags,
							status: initialStatus
						}) + '\n'
					)
				);

				// Subscribe to Redis Pub/Sub for real-time updates
				subscriberClient = streamStateStore.subscribeToUpdates(dreamId, (message) => {
					if (streamClosed) return; // Do nothing if stream is already closed

					// Check if controller is still readable before enqueueing
					if (controller.desiredSize !== null && controller.desiredSize <= 0) {
						console.debug(`Dream ${dreamId}: Client stream desiredSize <= 0, closing.`);
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
						console.debug(
							`Dream ${dreamId}: Client stream ending due to finalStatus: ${message.finalStatus}`
						);
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
			},
			async cancel() {
				console.debug(`Dream ${dreamId}: Client stream cancelled (ReadableStream cancel).`);
				if (subscriberClient) {
					await streamStateStore.unsubscribeFromUpdates(subscriberClient, dreamId);
					subscriberClient = null;
				}
				streamClosed = true;
			}
		});

		return new Response(clientStream, {
			headers: {
				'Content-Type': 'application/x-ndjson',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive'
			}
		});
	}

	throw error(500, 'Unexpected dream status or logic flow.');
}
