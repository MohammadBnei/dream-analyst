import type { Dream } from '@prisma/client';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { DreamPromptType } from '$lib/prompts/dreamAnalyst';
import { promptService } from '$lib/prompts/promptService';
import { getLLMService } from '$lib/server/llmService';
import { getPrismaClient } from '$lib/server/db';

class DreamAnalysisService {
	private llmService: ReturnType<typeof getLLMService>;
	private prisma: Awaited<ReturnType<typeof getPrismaClient>> | undefined;

	constructor() {
		this.llmService = getLLMService();
		getPrismaClient().then((client) => {
			this.prisma = client;
		});
	}

	private async getPrisma(): Promise<Awaited<ReturnType<typeof getPrismaClient>>> {
		if (!this.prisma) {
			this.prisma = await getPrismaClient();
		}
		return this.prisma;
	}

	/**
	 * Internal helper to initiate a raw streamed dream analysis from the LLM.
	 * This function is responsible only for interacting with the LLM and returning its raw text stream.
	 * @param dream The dream object.
	 * @param promptType The type of interpretation prompt to use.
	 * @param signal An AbortSignal to cancel the LLM request.
	 * @param pastDreamsContext Optional string containing context from past dreams.
	 * @returns An AsyncIterable<string> of raw LLM content (string chunks).
	 */
	private async _initiateRawStreamedDreamAnalysis(
		dream: Dream,
		promptType: DreamPromptType,
		signal?: AbortSignal,
		pastDreamsContext?: string
	): Promise<AsyncIterable<string>> {
		try {
			// Use the PromptService to get the system prompt, which now handles Jungian knowledge
			const systemPrompt = promptService.getSystemPrompt(promptType);

			let humanMessageContent = '';
			if (pastDreamsContext) {
				humanMessageContent += `Here are some of my past dreams for context:\n${pastDreamsContext}\n\n`;
			}
			humanMessageContent += `My current dream: ${dream.rawText}`;

			const messages = [new SystemMessage(systemPrompt), new HumanMessage(humanMessageContent)];

			// Use the LLMService to stream the chat completion
			const stream = await this.llmService.streamChatCompletion(messages, signal);

			// Return the raw LLM stream as an AsyncIterable<string>
			return stream;
		} catch (error) {
			console.error(`Error initiating LLM stream for dream ${dream.id}:`, error);
			// Re-throw the error to be handled by the caller (StreamProcessor)
			throw error;
		}
	}

	/**
	 * Orchestrates the dream analysis process, including fetching past dream context
	 * and initiating the LLM stream.
	 * @param dream The dream object to analyze.
	 * @param promptType The type of interpretation prompt to use.
	 * @param signal An AbortSignal to cancel the LLM request.
	 * @returns An AsyncIterable<string> of raw LLM content (string chunks).
	 */
	public async initiateDreamAnalysis(
		dream: Dream,
		promptType: DreamPromptType = 'jungian',
		signal?: AbortSignal
	): Promise<AsyncIterable<string>> {
		const prisma = await this.getPrisma();
		let pastDreamsContext = '';

		try {
			// 1. Fetch last 5 dreams in parallel
			const lastFiveDreamsPromise = prisma.dream.findMany({
				where: {
					userId: dream.userId,
					id: { not: dream.id } // Exclude the current dream
				},
				orderBy: {
					dreamDate: 'desc'
				},
				take: 5,
				select: {
					rawText: true,
					interpretation: true,
				}
			});

			// 2. Generate search terms from the new dream using the weak model
			const searchTermsPrompt = `Given the following dream text, extract 7 distinct keywords or short phrases (2-3 words max) that best describe its core themes, objects, or emotions. Separate them with commas. Use the same language as the dream text.
Example: "water,fire,mountain,shame"
Dream: "${dream.rawText}"
Keywords:`;
			const searchTermsPromise = this.llmService.generateText(searchTermsPrompt, signal);

			const [lastFiveDreams, rawSearchTerms] = await Promise.all([
				lastFiveDreamsPromise,
				searchTermsPromise
			]);

			const searchTerms = rawSearchTerms
				.split(',')
				.map((term) => term.trim().toLowerCase())
				.filter(Boolean);

			// 3. Filter the fetched dreams based on these search terms (simple full-text search)
			const relevantPastDreams = lastFiveDreams.filter((pastDream) => {
				const dreamContent =
					pastDream.rawText.toLowerCase();
				return searchTerms.some((term) => dreamContent.includes(term));
			});

			// 4. Construct the pastDreamsContext string from the filtered dreams
			if (relevantPastDreams.length > 0) {
				pastDreamsContext = relevantPastDreams
					.map(
						(d, index) =>
							`Dream ${index + 1}:\nRaw Text: ${d.rawText}\nInterpretation: ${d.interpretation || 'N/A'}`
					)
					.join('\n\n');
			}
		} catch (e) {
			console.warn(`Dream ${dream.id}: Failed to fetch or process past dreams context:`, e);
			// Continue without past dream context if there's an error
			pastDreamsContext = '';
		}

		// Now, initiate the raw streamed analysis with the gathered context
		return this._initiateRawStreamedDreamAnalysis(dream, promptType, signal, pastDreamsContext);
	}
}

let dreamAnalysisServiceInstance: DreamAnalysisService;

export function getDreamAnalysisService(): DreamAnalysisService {
	if (!dreamAnalysisServiceInstance) {
		dreamAnalysisServiceInstance = new DreamAnalysisService();
	}
	return dreamAnalysisServiceInstance;
}
