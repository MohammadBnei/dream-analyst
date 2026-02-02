/**
 * Stream Analysis Endpoint - Streams dream interpretation via EventBus
 * 
 * Connects to the EventBus to receive real-time updates from InterpretationActor
 */

import { error } from '@sveltejs/kit';
import { getDreamRepository } from '$lib/server/dreamRepository';
import { getPipelineCoordinator } from '$lib/server/pipelineCoordinator';
import { DreamStatus } from '@prisma/client';
import { DreamState, EventType } from '$lib/types';

const encoder = new TextEncoder();

function getCurrentUser(locals: App.Locals) {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}
	return locals.user;
}

export async function GET({ params, locals }) {
	const dreamId = params.id;
	const sessionUser = getCurrentUser(locals);

	if (!dreamId) {
		throw error(400, 'Dream ID is required.');
	}

	const dreamRepository = getDreamRepository();
	const dream = await dreamRepository.getDream(dreamId);

	if (!dream || dream.userId !== sessionUser.id) {
		throw error(403, 'Forbidden: Dream does not belong to user or does not exist.');
	}

	// If analysis is already completed or failed, return final result immediately
	if (dream.status === DreamStatus.COMPLETED || dream.status === DreamStatus.ANALYSIS_FAILED) {
		const finalChunk = {
			content: dream.interpretation || '',
			tags: (dream.tags as string[]) || [],
			status: dream.status,
			state: dream.state,
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

	// Stream real-time updates from the EventBus
	const coordinator = await getPipelineCoordinator();
	const eventBus = coordinator.getEventBus();

	let streamClosed = false;

	const clientStream = new ReadableStream({
		async start(controller) {
			// Send initial state
			controller.enqueue(
				encoder.encode(
					JSON.stringify({
						content: dream.interpretation || '',
						tags: (dream.tags as string[]) || [],
						status: dream.status,
						state: dream.state || DreamState.CREATED
					}) + '\n'
				)
			);

			// Listen for interpretation chunks
			const chunkHandler = (data: any) => {
				if (streamClosed || data.dreamId !== dreamId) return;


				try {
					controller.enqueue(
						encoder.encode(
							JSON.stringify({
								content: data.chunk,
								accumulated: data.accumulated,
								status: DreamStatus.PENDING_ANALYSIS,
								state: DreamState.INTERPRETING
							}) + '\n'
						)
					);
				} catch (err) {
					console.warn(`Dream ${dreamId}: Error enqueueing chunk:`, err);
				}
			};

			// Listen for state changes
			const stateChangeHandler = async (data: any) => {
				if (streamClosed || data.dreamId !== dreamId) return;

				try {
					// Fetch updated dream
					const updatedDream = await dreamRepository.getDream(dreamId);
					if (!updatedDream) return;

					const message: any = {
						status: updatedDream.status,
						state: data.newState
					};

					// If dream is completed or failed, send final message
					if (
						data.newState === DreamState.COMPLETED ||
						data.newState === DreamState.FAILED
					) {
						message.content = updatedDream.interpretation || '';
						message.tags = (updatedDream.tags as string[]) || [];
						message.finalStatus =
							data.newState === DreamState.COMPLETED ? 'COMPLETED' : 'ANALYSIS_FAILED';

						controller.enqueue(encoder.encode(JSON.stringify(message) + '\n'));

						// Clean up and close
						eventBus.off(EventType.INTERPRETATION_CHUNK, chunkHandler);
						eventBus.off(EventType.STATE_CHANGED, stateChangeHandler);
						if (!streamClosed) {
							controller.close();
							streamClosed = true;
						}
					} else {
						controller.enqueue(encoder.encode(JSON.stringify(message) + '\n'));
					}
				} catch (err) {
					console.warn(`Dream ${dreamId}: Error handling state change:`, err);
				}
			};

			// Subscribe to events
			eventBus.on(EventType.INTERPRETATION_CHUNK, chunkHandler);
			eventBus.on(EventType.STATE_CHANGED, stateChangeHandler);

			// If the dream is in an early state (CREATED, ENRICHING), the pipeline will handle it
			// No need to manually start the pipeline here - it's started in +page.server.ts
		},
		async cancel() {
			console.debug(`Dream ${dreamId}: Client stream cancelled.`);
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
