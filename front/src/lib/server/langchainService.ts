import { env } from '$env/dynamic/private';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { DreamPromptType } from '../prompts/dreamAnalyst';
import { promptService } from '$lib/prompts/promptService';
import type { Dream } from '@prisma/client'; // Import Dream type
import { getDreamAnalysisService } from './dreamAnalysisService'; // Import the new DreamAnalysisService

const OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL_NAME = env.OPENROUTER_MODEL_NAME || 'mistralai/mistral-7b-instruct-v0.2'; // Default model
const YOUR_SITE_URL = env.ORIGIN; // Optional, for OpenRouter rankings

/**
 * Initiates a raw streamed dream analysis from the LLM.
 * This function is responsible only for interacting with the LLM and returning its raw text stream.
 * Credit deduction and database updates are handled by the StreamProcessor.
 *
 * @param dream The dream object.
 * @param promptType The type of interpretation prompt to use.
 * @param signal An AbortSignal to cancel the LLM request.
 * @param pastDreamsContext Optional string containing context from past dreams.
 * @returns An AsyncIterable<string> of raw LLM content (string chunks).
 */
export async function initiateRawStreamedDreamAnalysis(
	dream: Dream,
	promptType: DreamPromptType = 'jungian', // Add promptType parameter with a default
	signal?: AbortSignal,
	pastDreamsContext?: string // Add pastDreamsContext parameter
): Promise<AsyncIterable<string>> {
	// This function is now deprecated and should not be called directly.
	// The logic has been moved to DreamAnalysisService.initiateDreamAnalysis.
	// For backward compatibility or if this function is still used elsewhere,
	// it should delegate to the new service.

	const dreamAnalysisService = getDreamAnalysisService();
	return dreamAnalysisService.initiateDreamAnalysis(dream, promptType, signal);
}
