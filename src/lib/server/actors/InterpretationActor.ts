/**
 * InterpretationActor - Streams LLM interpretation of dream using gathered context
 */

import type { Dream } from '@prisma/client';
import { DreamActor, type ActorResult } from './DreamActor';
import type { DreamPromptType } from '$lib/prompts/dreamAnalyst';
import { promptService } from '$lib/prompts/promptService';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { getLLMService } from '../llmService';
import { DreamState, EventType } from '$lib/types';

export class InterpretationActor extends DreamActor {
	name = 'InterpretationActor';
	completeEvent = EventType.INTERPRETATION_COMPLETE;
	failEvent = EventType.INTERPRETATION_FAILED;
	dependsOn = []; // PipelineCoordinator already ensures Enrichment is complete
	triggers = [EventType.INTERPRETATION_STARTED];
	allowedInStates = [DreamState.INTERPRETING, DreamState.INTERPRETING_REVISION];

	private llmService = getLLMService();

	protected async execute(dream: Dream, signal?: AbortSignal): Promise<ActorResult> {
		try {
			// Get prompt type from dream or default to jungian
			const promptType = (dream.promptType as DreamPromptType) || 'jungian';

			// Get system prompt
			const systemPrompt = promptService.getSystemPrompt(promptType);

			// Fetch dream with relations to build context
			const dreamWithRelations = await this.dreamRepository.getDreamWithRelations(dream.id);
			if (!dreamWithRelations) {
				throw new Error(`Dream ${dream.id} not found`);
			}

			// Build context from related dreams
			let pastDreamsContext = '';
			if (dreamWithRelations.relatedTo && dreamWithRelations.relatedTo.length > 0) {
				pastDreamsContext += 'Here are some of my past dreams for context:\n';
				pastDreamsContext += dreamWithRelations.relatedTo
					.map(
						(d) =>
							`- ${d.title || 'Untitled'} (Date: ${d.dreamDate.toLocaleDateString()}):\nRaw Text: """${d.rawText}"""`
					)
					.join('\n');
				pastDreamsContext += '\n\n';
			}

			// Build human message
			const humanMessageContent = `${pastDreamsContext}My current dream: ${dreamWithRelations.rawText}`;

			const messages = [new SystemMessage(systemPrompt), new HumanMessage(humanMessageContent)];

			// Stream the LLM response with a 60-second timeout for the initial connection
			const stream = await this.llmService.streamChatCompletion(messages, signal);

			// Accumulate the interpretation
			let accumulatedInterpretation = '';
			const streamTimeout = 30000; // 30 seconds between chunks
			let lastChunkTime = Date.now();

			for await (const chunk of stream) {
				if (signal?.aborted) {
					throw new Error('Interpretation cancelled by user');
				}
				
				if (Date.now() - lastChunkTime > streamTimeout) {
					throw new Error('Interpretation stream stalled');
				}
				lastChunkTime = Date.now();

				accumulatedInterpretation += chunk;

				console.log({ chunk })

				// Emit streaming updates for real-time display
				await this.eventBus.emit(EventType.INTERPRETATION_CHUNK, {
					dreamId: dream.id,
					chunk,
					accumulated: accumulatedInterpretation
				});
			}

			// Save final interpretation to database
			await this.dreamRepository.updateDream(dream.id, {
				interpretation: accumulatedInterpretation
			});

			return {
				success: true,
				data: {
					interpretation: accumulatedInterpretation,
					promptType
				}
			};
		} catch (error) {
			// Hard failure - interpretation is required
			console.error(`${this.name}: Failed to generate interpretation:`, error);
			return {
				success: false,
				error: error instanceof Error ? error : new Error(String(error))
			};
		}
	}
}
