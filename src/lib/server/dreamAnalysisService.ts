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
	 * Fetches the user's last five dreams (excluding the current one).
	 * @param dream The current dream being analyzed.
	 * @returns An array of the last five Dream objects or an empty array if none.
	 */
	private async _getPastFiveDreams(dream: Dream): Promise<Dream[]> {
		const prisma = await this.getPrisma();
		try {
			const lastFiveDreams = await prisma.dream.findMany({
				where: {
					userId: dream.userId,
					id: { not: dream.id } // Exclude the current dream
				},
				orderBy: {
					dreamDate: 'desc'
				},
				take: 5,
				select: {
					id: true,
					rawText: true,
					interpretation: true,
					userId: true,
					status: true,
					dreamDate: true,
					createdAt: true,
					updatedAt: true,
					analysisText: true,
					promptType: true,
					tags: true,
					title: true // Include title
				}
			});
			return lastFiveDreams;
		} catch (e) {
			console.warn(`Dream ${dream.id}: Failed to fetch last five dreams:`, e);
		}
		return [];
	}

	/**
	 * Generates search terms from the current dream and performs a full-text search
	 * on past dreams, returning the relevant Dream objects.
	 * @param dream The current dream being analyzed.
	 * @param signal An AbortSignal for the LLM call.
	 * @returns An array of relevant Dream objects or an empty array if none.
	 */
	private async _getRelevantPastDreams(dream: Dream, signal?: AbortSignal): Promise<Dream[]> {
		const prisma = await this.getPrisma();
		try {
			// 1. Generate search terms from the new dream using the weak model
			const searchTermsPrompt = `Given the following dream text, extract 7 distinct keywords or short phrases (2-3 words max) that best describe its core themes, objects, or emotions. Separate them with commas. Use the same language as the dream text. Do not respond with anything else than the keywords, separated by commas.
Example: "water,fire,mountain,shame"
Dream: "${dream.rawText}"
Keywords:`;
			const rawSearchTerms = await this.llmService.generateText(searchTermsPrompt, signal);

			const searchTerms = rawSearchTerms
				.split(',')
				.map((term) => term.trim())
				.filter(Boolean);

			// 2. Perform a full-text search on past dreams using the generated search terms
			if (searchTerms.length > 0) {
				const relevantPastDreams = await prisma.dream.findMany({
					where: {
						userId: dream.userId,
						id: { not: dream.id }, // Exclude the current dream
						OR: [
							{
								rawText: {
									search: searchTerms.join(' | ') // Use OR for full-text search
								}
							},
							{
								interpretation: {
									search: searchTerms.join(' | ')
								}
							}
						]
					},
					orderBy: {
						dreamDate: 'desc'
					},
					take: 5, // Limit to a reasonable number of relevant dreams
					select: {
						id: true,
						rawText: true,
						interpretation: true,
						userId: true,
						status: true,
						dreamDate: true,
						createdAt: true,
						updatedAt: true,
						analysisText: true,
						promptType: true,
						tags: true,
						title: true // Include title
					}
				});
				return relevantPastDreams;
			}
		} catch (e) {
			console.warn(`Dream ${dream.id}: Failed to fetch or process relevant past dreams:`, e);
		}
		return [];
	}

	/**
	 * Generates a concise title for the dream using the weak LLM.
	 * @param dreamText The raw text of the dream.
	 * @param signal An AbortSignal to cancel the LLM request.
	 * @returns A promise that resolves to the generated title string.
	 */
	public async generateDreamTitle(dreamText: string, signal?: AbortSignal): Promise<string> {
		const titlePrompt = `Create a very short, evocative title (under 10 words) for the following dream. Focus on the most prominent image or feeling. Use the same language as the dream text. Do not respond anything besides the dream's title.
Dream: "${dreamText}"
Title:`;
		try {
			const title = await this.llmService.generateText(titlePrompt, signal);
			return title.trim().replace(/^"|"$/g, ''); // Remove leading/trailing quotes if LLM adds them
		} catch (error) {
			console.error('Error generating dream title:', error);
			return 'Untitled Dream'; // Fallback title
		}
	}

	/**
	 * Finds and sets related dreams for a given dream. This method can be called
	 * independently to regenerate or update related dreams.
	 * @param dream The dream object for which to find and set relations.
	 * @param signal An AbortSignal to cancel the LLM request.
	 * @returns The updated dream object with new related dreams.
	 */
	public async findAndSetRelatedDreams(dream: Dream, signal?: AbortSignal): Promise<Dream> {
		const prisma = await this.getPrisma();
		const relatedDreamIds: string[] = [];

		// Run both context-gathering methods in parallel
		const [lastFiveDreamsResult, relevantDreamsResult] = await Promise.allSettled([
			this._getPastFiveDreams(dream),
			this._getRelevantPastDreams(dream, signal)
		]);

		const allRelatedDreams: Dream[] = [];

		if (lastFiveDreamsResult.status === 'fulfilled' && lastFiveDreamsResult.value.length > 0) {
			allRelatedDreams.push(...lastFiveDreamsResult.value);
		}
		if (relevantDreamsResult.status === 'fulfilled' && relevantDreamsResult.value.length > 0) {
			// Filter out duplicates if a dream appears in both lists
			const newRelevantDreams = relevantDreamsResult.value.filter(
				(rd) => !allRelatedDreams.some((ard) => ard.id === rd.id)
			);
			allRelatedDreams.push(...newRelevantDreams);
		}

		// Collect all unique related dream IDs
		allRelatedDreams.forEach((d) => relatedDreamIds.push(d.id));

		// Disconnect all existing related dreams first to ensure a clean update
		await prisma.dream.update({
			where: { id: dream.id },
			data: {
				relatedTo: {
					set: [] // Disconnect all
				},
				relatedBy: {
					set: [] // Disconnect all inverse relations
				}
			}
		});

		return prisma.dream.update({
			where: { id: dream.id },
			data: {
				relatedTo: {
					connect: relatedDreamIds.map((id) => ({ id }))
				},
				updatedAt: new Date()
			},
			select: {
				id: true,
				rawText: true,
				title: true,
				interpretation: true,
				status: true,
				dreamDate: true,
				createdAt: true,
				updatedAt: true,
				userId: true,
				analysisText: true,
				promptType: true,
				tags: true,
				relatedTo: {
					select: {
						id: true,
						title: true,
						dreamDate: true,
						rawText: true
					}
				}
			}
		});
	}

	/**
	 * Orchestrates the dream analysis process, including fetching past dream context
	 * and initiating the LLM stream.
	 * NOTE: This method no longer handles `findAndSetRelatedDreams` or `generateDreamTitle`.
	 * Those operations are expected to be completed *before* calling this method.
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

		// Fetch the dream again to ensure we have the latest relatedTo data
		const dreamWithRelations = await prisma.dream.findUnique({
			where: { id: dream.id },
			select: {
				id: true,
				rawText: true,
				title: true,
				interpretation: true,
				status: true,
				dreamDate: true,
				createdAt: true,
				updatedAt: true,
				userId: true,
				analysisText: true,
				promptType: true,
				tags: true,
				relatedTo: {
					select: {
						id: true,
						title: true,
						dreamDate: true,
						rawText: true,
						interpretation: true // Ensure interpretation is selected for context
					}
				}
			}
		});

		if (!dreamWithRelations) {
			throw new Error(`Dream with ID ${dream.id} not found for analysis context.`);
		}

		// Build the pastDreamsContext from the already established relations
		if (dreamWithRelations.relatedTo && dreamWithRelations.relatedTo.length > 0) {
			pastDreamsContext += dreamWithRelations.relatedTo
				.map(
					(d, index) =>
						`Related Dream ${index + 1}:\nRaw Text: ${d.rawText}\nInterpretation: ${d.interpretation || 'N/A'}`
				)
				.join('\n\n');
		}

		// Now, initiate the raw streamed analysis with the gathered context
		const stream = await this._initiateRawStreamedDreamAnalysis(
			dream,
			promptType,
			signal,
			pastDreamsContext
		);

		return stream;
	}
}

let dreamAnalysisServiceInstance: DreamAnalysisService;

export function getDreamAnalysisService(): DreamAnalysisService {
	if (!dreamAnalysisServiceInstance) {
		dreamAnalysisServiceInstance = new DreamAnalysisService();
	}
	return dreamAnalysisServiceInstance;
}
