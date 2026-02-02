/**
 * TitleGenerationActor - Generates concise, evocative titles for dreams
 */

import type { Dream } from '@prisma/client';
import { DreamActor, type ActorResult } from './DreamActor';
import { getLLMService } from '../llmService';
import { DreamState, EventType } from '$lib/types';

export class TitleGenerationActor extends DreamActor {
	name = 'TitleGenerationActor';
	completeEvent = EventType.TITLE_GENERATION_COMPLETE;
	failEvent = EventType.TITLE_GENERATION_FAILED;
	dependsOn: (string | EventType)[] = []; // No dependencies, can run immediately
	triggers = [EventType.ENRICHMENT_STARTED];
	allowedInStates = [DreamState.ENRICHING, DreamState.ENRICHING_REVISION];

	private llmService = getLLMService();

	protected async execute(dream: Dream, signal?: AbortSignal): Promise<ActorResult> {
		try {
			const titlePrompt = `Create a very short, evocative title (under 10 words) for the following dream. Focus on the most prominent image or feeling. Use the same language as the dream text. Do not respond anything besides the dream's title.
Dream: "${dream.rawText}"
Title:`;

			const title = await this.llmService.generateText(titlePrompt, signal);
			const cleanTitle = title.trim().replace(/^"|"$/g, ''); // Remove quotes if LLM adds them

			// Update dream with generated title
			await this.dreamRepository.updateDream(dream.id, {
				title: cleanTitle
			});

			return {
				success: true,
				data: { title: cleanTitle }
			};
		} catch (error) {
			// Soft failure - use fallback title
			const fallbackTitle = 'Untitled Dream';
			try {
				await this.dreamRepository.updateDream(dream.id, {
					title: fallbackTitle
				});
			} catch (dbError) {
				console.error(`${this.name}: Failed to save fallback title:`, dbError);
			}

			console.warn(`${this.name}: Failed to generate title, using fallback:`, error);
			
			return {
				success: true, // ALWAYS SUCCESS for optional enrichment
				data: { title: fallbackTitle, usedFallback: true }
			};
		}
	}
}
