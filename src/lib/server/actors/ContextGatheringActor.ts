/**
 * ContextGatheringActor - Gathers context from past dreams for interpretation
 */

import type { Dream } from '@prisma/client';
import { DreamActor, type ActorResult } from './DreamActor';
import { DreamState, EventType } from '$lib/types';

export class ContextGatheringActor extends DreamActor {
	name = 'ContextGatheringActor';
	completeEvent = EventType.CONTEXT_GATHERING_COMPLETE;
	failEvent = EventType.CONTEXT_GATHERING_FAILED;
	dependsOn: (string | EventType)[] = [];
	triggers = [EventType.ENRICHMENT_STARTED];
	allowedInStates = [DreamState.ENRICHING, DreamState.ENRICHING_REVISION];

	protected async execute(dream: Dream, signal?: AbortSignal): Promise<ActorResult> {
		try {
			// Fetch the last 3 dreams for this user
			const lastDreams = await this.dreamRepository.getLastDreams(dream.userId, dream.id, 3);

			// Format context string
			let contextString = '';
			if (lastDreams.length > 0) {
				contextString = 'Here are some of my past dreams for context:\n';
				contextString += lastDreams
					.map(
						(d) =>
							`- ${d.title || 'Untitled'} (Date: ${d.dreamDate.toLocaleDateString()}):\nRaw Text: """${d.rawText}"""`
					)
					.join('\n');
			}

			return {
				success: true,
				data: {
					contextString,
					pastDreamsCount: lastDreams.length,
					pastDreams: lastDreams
				}
			};
		} catch (error) {
			// Soft failure - continue without context
			console.warn(`${this.name}: Failed to gather context:`, error);
			return {
				success: true, // ALWAYS SUCCESS for optional enrichment
				data: {
					contextString: '',
					pastDreamsCount: 0,
					pastDreams: []
				}
			};
		}
	}
}
