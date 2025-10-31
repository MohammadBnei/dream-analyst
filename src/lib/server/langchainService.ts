import { env } from '$env/dynamic/private';
import type { Dream } from '@prisma/client';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { DreamPromptType } from '../prompts/dreamAnalyst'; // Import the type
import { promptService } from '$lib/prompts/promptService';
// Removed: import type { AnalysisStreamChunk } from '$lib/types/analysis'; // Now imported from shared types

const OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL_NAME = env.OPENROUTER_MODEL_NAME || 'mistralai/mistral-7b-instruct-v0.2'; // Default model
const YOUR_SITE_URL = env.ORIGIN; // Optional, for OpenRouter rankings

// Removed: AnalysisStreamChunk definition is now in src/lib/types/analysis.d.ts

/**
 * Initiates a raw streamed dream analysis from the LLM.
 * This function is responsible only for interacting with the LLM and returning its raw text stream.
 * Credit deduction and database updates are handled by the StreamProcessor.
 *
 * @param dream The dream object.
 * @param promptType The type of interpretation prompt to use.
 * @param signal An AbortSignal to cancel the LLM request.
 * @returns An AsyncIterable<string> of raw LLM content (string chunks).
 */
export async function initiateRawStreamedDreamAnalysis(
	dream: Dream,
	promptType: DreamPromptType = 'jungian', // Add promptType parameter with a default
	signal?: AbortSignal
): Promise<AsyncIterable<string>> {
	if (!OPENROUTER_API_KEY) {
		throw new Error('OPENROUTER_API_KEY is not defined');
	}

	try {
		const chat = new ChatOpenAI({
			model: OPENROUTER_MODEL_NAME,
			temperature: 0.7, // A reasonable default for creative tasks
			streaming: true,
			apiKey: OPENROUTER_API_KEY,
			configuration: {
				baseURL: 'https://openrouter.ai/api/v1',
				defaultHeaders: {
					...(YOUR_SITE_URL && { 'HTTP-Referer': YOUR_SITE_URL })
				}
			}
		});

		// Use the PromptService to get the system prompt, which now handles Jungian knowledge
		const systemPrompt = promptService.getSystemPrompt(promptType);
		const messages = [new SystemMessage(systemPrompt), new HumanMessage(`My dream: ${dream.rawText}`)];

		const stream = await chat.stream(messages, {
			signal: signal // Pass the abort signal directly to the stream method
		});

		// Return the raw LangChain stream as an AsyncIterable<string>
		return (async function* () {
			for await (const chunk of stream) {
				if (signal?.aborted) {
					console.debug(`Dream ${dream.id}: LangChain stream aborted by signal.`);
					break; // Exit the loop if aborted
				}
				if (chunk.content) {
					yield chunk.content; // Yield raw string content
				}
			}
		})();
	} catch (error) {
		console.error(`Error initiating LangChain stream for dream ${dream.id}:`, error);
		// Re-throw the error to be handled by the caller (StreamProcessor)
		throw error;
	}
}
