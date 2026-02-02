/**
 * RelationshipActor - Finds and links related dreams using keyword extraction and search
 */

import type { Dream } from '@prisma/client';
import { DreamActor, type ActorResult } from './DreamActor';
import { getLLMService } from '../llmService';
import { DreamState, EventType } from '$lib/types';

export class RelationshipActor extends DreamActor {
	name = 'RelationshipActor';
	completeEvent = EventType.RELATIONSHIP_COMPLETE;
	failEvent = EventType.RELATIONSHIP_FAILED;
	dependsOn: (string | EventType)[] = [];
	triggers = [EventType.ENRICHMENT_STARTED];
	allowedInStates = [DreamState.ENRICHING, DreamState.ENRICHING_REVISION];

	private llmService = getLLMService();

	protected async execute(dream: Dream, signal?: AbortSignal): Promise<ActorResult> {
		try {
			// 1. Generate search terms from the dream using the weak model
			const searchTermsPrompt = `Given the following dream text, extract 10 distinct keywords or short phrases (2-3 words max) that best describe its core themes, objects, or emotions. These keywords will be used to search for similar dreams. Separate them with commas. Use the same language as the dream text. Do not respond with anything else than the keywords, separated by commas.
Example: "water,fire,mountain,shame"
Dream: "${dream.rawText}"
Keywords:`;

			const rawSearchTerms = await this.llmService.generateText(searchTermsPrompt, signal);

			const searchTerms = rawSearchTerms
				.split(',')
				.map((term) => term.trim())
				.filter(Boolean);

			if (searchTerms.length === 0) {
				console.warn(`${this.name}: No search terms generated for dream ${dream.id}`);
				return {
					success: true,
					data: { relatedDreamIds: [], searchTerms: [] }
				};
			}

			// 2. Search for relevant dreams using full-text search
			const relevantDreams = await this.dreamRepository.searchRelevantDreams(
				dream.userId,
				searchTerms,
				dream.id,
				5
			);

			// 3. Also fetch last dreams for chronological context
			const lastDreams = await this.dreamRepository.getLastDreams(dream.userId, dream.id, 3);

			// 4. Combine and deduplicate
			const allRelatedDreams = [...lastDreams];
			const seenIds = new Set(lastDreams.map((d) => d.id));

			for (const relevantDream of relevantDreams) {
				if (!seenIds.has(relevantDream.id)) {
					allRelatedDreams.push(relevantDream);
					seenIds.add(relevantDream.id);
				}
			}

			const relatedDreamIds = allRelatedDreams.map((d) => d.id);

			// 5. Update dream with related dreams
			if (relatedDreamIds.length > 0) {
				await this.dreamRepository.setRelatedDreams(dream.id, relatedDreamIds);
			}

			return {
				success: true,
				data: {
					relatedDreamIds,
					searchTerms,
					count: relatedDreamIds.length
				}
			};
		} catch (error) {
			// Soft failure - continue without relationships
			console.warn(`${this.name}: Failed to find relationships:`, error);
			return {
				success: true, // ALWAYS SUCCESS for optional enrichment
				data: {
					relatedDreamIds: [],
					searchTerms: [],
					count: 0
				}
			};
		}
	}
}
