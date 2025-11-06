import type { Dream } from '@prisma/client';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { DreamPromptType } from '$lib/prompts/dreamAnalyst';
import { promptService } from '$lib/prompts/promptService';
import { getLLMService } from '$lib/server/services/llmService'; // Import the new LLMService

/**
 * Initiates a raw streamed dream analysis from the LLM.
 * This function is responsible only for interacting with the LLM and returning its raw text stream.
 * Credit deduction and database updates are handled by the StreamProcessor (not shown here).
 *
 * @param dream The dream object.
 * @param promptType The type of interpretation prompt to use.
 * @param signal An AbortSignal to cancel the LLM request.
 * @returns An AsyncIterable<string> of raw LLM content (string chunks).
 */
export async function initiateRawStreamedDreamAnalysis(
	dream: Dream,
	promptType: DreamPromptType = 'jungian',
	signal?: AbortSignal
): Promise<AsyncIterable<string>> {
	const llmService = getLLMService(); // Get the LLMService instance

	try {
		// Use the PromptService to get the system prompt, which now handles Jungian knowledge
		const systemPrompt = promptService.getSystemPrompt(promptType);
		const messages = [
			new SystemMessage(systemPrompt),
			new HumanMessage(`My dream: ${dream.rawText}`)
		];

		// Use the LLMService to stream the chat completion
		const stream = await llmService.streamChatCompletion(messages, signal);

		// Return the raw LLM stream as an AsyncIterable<string>
		return stream; // LLMService already returns AsyncIterable<string>
	} catch (error) {
		console.error(`Error initiating LLM stream for dream ${dream.id}:`, error);
		// Re-throw the error to be handled by the caller (StreamProcessor)
		throw error;
	}
}
