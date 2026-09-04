import { error } from '@sveltejs/kit';
import { getPrismaClient } from '$lib/server/db';
import { getStreamStateStore } from '$lib/server/streamStateStore';
import { getOrCreateStreamProcessor } from '$lib/server/streamProcessor';
import { DreamStatus } from '@prisma/client';
import type Redis from 'ioredis';
import { DREAM_PROMPT_TYPES, type DreamPromptType } from '$lib/promptTypes';
import { requireOwnedDream } from '$lib/server/guards';

const encoder = new TextEncoder();

export async function GET({ params, locals, platform, request }) {
	const dreamId = params.id;
	if (!dreamId) error(400, 'Dream ID is required.');

	const dream = await requireOwnedDream(locals, dreamId);

	const streamStateStore = await getStreamStateStore();
	const prisma = getPrismaClient();

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

	// An analysis runs only when one has been paid for. `analysisPaidAt` is the
	// entitlement: set by claimAnalysis when charged, cleared when the run ends.
	//
	// This is a state check, not billing logic - and it is what makes unpaid work
	// structurally impossible rather than merely unreachable. Gating on status
	// alone was not enough: other code paths write status, so a dream could arrive
	// here PENDING_ANALYSIS without anyone having paid.
	if (dream.status === DreamStatus.PENDING_ANALYSIS && dream.analysisPaidAt === null) {
		error(402, 'This analysis has not been paid for.');
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
				// One cleanup path. Previously the unsubscribe was written out three
				// times (slow-client branch, finalStatus branch, cancel) and skipped
				// entirely if start() threw after subscribing, leaking the connection.
				const cleanup = async () => {
					if (subscriberClient) {
						const client = subscriberClient;
						subscriberClient = null;
						await streamStateStore.unsubscribeFromUpdates(client, dreamId);
					}
				};
				const closeStream = async () => {
					if (streamClosed) return;
					streamClosed = true;
					await cleanup();
					controller.close();
				};

				try {
					const initialRedisState = await streamStateStore.getStreamState(dreamId);
					const initialDream = await prisma.dream.findUnique({
						where: { id: dreamId },
						select: { interpretation: true, status: true }
					});

					controller.enqueue(
						encoder.encode(
							JSON.stringify({
								content: initialRedisState?.interpretation || initialDream?.interpretation || '',
								status:
									initialRedisState?.status || initialDream?.status || DreamStatus.PENDING_ANALYSIS
							}) + '\n'
						)
					);

					subscriberClient = streamStateStore.subscribeToUpdates(dreamId, (message) => {
						if (streamClosed) return;

						// Every message is enqueued. This used to close the stream when
						// controller.desiredSize <= 0, treating a slow consumer as a reason
						// to stop - which silently truncated the analysis mid-sentence for
						// anyone on a poor connection. Published content is a DELTA, not the
						// accumulated text, so a dropped frame loses words permanently.
						//
						// Buffering is bounded in practice: the LLM call caps at
						// max_tokens (4096), so a whole analysis is on the order of tens of
						// kilobytes even if the client reads none of it.
						controller.enqueue(encoder.encode(JSON.stringify(message) + '\n'));

						if (message.finalStatus) {
							void closeStream();
						}
					});
				} catch (e) {
					// Without this the subscriber above stayed open forever.
					await cleanup();
					controller.error(e);
				}
			},
			async cancel() {
				// Fires when the client disconnects.
				streamClosed = true;
				if (subscriberClient) {
					const client = subscriberClient;
					subscriberClient = null;
					await streamStateStore.unsubscribeFromUpdates(client, dreamId);
				}
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
