import type { Dream } from '@prisma/client';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { DreamPromptType } from '$lib/prompts/dreamAnalyst';
import { promptService } from '$lib/prompts/promptService';
import { getLLMService } from '$lib/server/llmService';
import { getPrismaClient } from '$lib/server/db';
import type { StructuredDreamAnalysis } from '$lib/types/structuredAnalysis';
import { STRUCTURED_ANALYSIS_FUNCTION_SCHEMA } from '$lib/types/structuredAnalysis';
import { metadataConfigService, dreamService } from './services';

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
	 * Fetches the user's last three dreams (excluding the current one) based on dreamDate.
	 * @param dream The current dream being analyzed.
	 * @returns An array of the last three Dream objects or an empty array if none.
	 */
	private async _getPastDreams(dream: Dream) {
		const prisma = await this.getPrisma();
		try {
			const lastDreams = await prisma.dream.findMany({
				where: {
					userId: dream.userId,
					id: { not: dream.id } // Exclude the current dream
				},
				orderBy: {
					dreamDate: 'desc'
				},
				take: 3, // Changed from 5 to 3
				select: {
					id: true,
					rawText: true,
					dreamDate: true,
					status: true
				}
			});
			return lastDreams;
		} catch (e) {
			console.warn(`Dream ${dream.id}: Failed to fetch last dreams:`, e);
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
			const searchTermsPrompt = `Given the following dream text, extract 10 distinct keywords or short phrases (2-3 words max) that best describe its core themes, objects, or emotions. These keywords will be used to search for similar dreams. Separate them with commas. Use the same language as the dream text. Do not respond with anything else than the keywords, separated by commas.
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
									search: searchTerms.join('|'), // Use OR for full-text search
									mode: 'insensitive'
								}
							},
							{
								interpretation: {
									search: searchTerms.join('|'),
									mode: 'insensitive'
								}
							},
							{
								title: {
									search: searchTerms.join('|'),
									mode: 'insensitive'
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
		const [lastDreamsResult, relevantDreamsResult] = await Promise.allSettled([
			this._getPastDreams(dream), // Renamed method
			this._getRelevantPastDreams(dream, signal)
		]);

		const allRelatedDreams: Partial<Dream>[] = [];

		if (lastDreamsResult.status === 'fulfilled' && lastDreamsResult.value.length > 0) {
			allRelatedDreams.push(...lastDreamsResult.value);
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
						dreamDate: true, // Include dreamDate
						rawText: true
						// interpretation: true // Removed interpretation
					}
				}
			}
		});

		if (!dreamWithRelations) {
			throw new Error(`Dream with ID ${dream.id} not found for analysis context.`);
		}

		// Build the pastDreamsContext from the already established relations
		if (dreamWithRelations.relatedTo && dreamWithRelations.relatedTo.length > 0) {
			pastDreamsContext += `Here are some of my past dreams for context:\n`;
			pastDreamsContext += dreamWithRelations.relatedTo
				.map(
					(d) =>
						`- ${d.title} (Date: ${d.dreamDate.toLocaleDateString()}):\nRaw Text: """${d.rawText}"""` // Added dreamDate, removed interpretation
				)
				.join('\n');
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

	/**
	 * Phase 2: Analyze dream with structured output (version 2).
	 * This is the new recommended method for all dream analyses.
	 * Falls back to legacy analysis if structured output fails.
	 */
	public async analyzeDreamV2(
		dreamId: string,
		userId: string,
		platform?: { context?: { waitUntil?: (promise: Promise<unknown>) => void } },
		signal?: AbortSignal
	): Promise<ReadableStream<Uint8Array>> {
		const prisma = await getPrismaClient();

		// Fetch dream and check if it should use structured analysis
		const dream = await prisma.dream.findUnique({
			where: { id: dreamId },
			select: { id: true, createdAt: true, rawText: true, promptType: true }
		});

		if (!dream) {
			throw new Error(`Dream not found: ${dreamId}`);
		}

		// Use structured analysis for all new dreams
		// (This can be adjusted with a feature flag or date cutoff)
		const useStructured = this.shouldUseStructuredAnalysis(dream);

		if (useStructured) {
			// Generate structured analysis (non-streaming for now)
			try {
				await this.analyzeWithStructuredOutput(dreamId, userId, signal);

				// Return a simple completion stream
				const encoder = new TextEncoder();
				const readable = new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(
							encoder.encode(
								JSON.stringify({
									status: 'COMPLETED',
									version: 2,
									message: 'Structured analysis complete'
								}) + '\n'
							)
						);
						controller.close();
					}
				});

				return readable;
			} catch (error) {
				console.error('Structured analysis failed, falling back to legacy:', error);
				// Fall back to legacy analysis
				return this.analyzeDream(dreamId, userId, platform, signal);
			}
		} else {
			// Use legacy analysis
			return this.analyzeDream(dreamId, userId, platform, signal);
		}
	}

	// ========== Phase 2: Structured Analysis Methods ==========

	/**
	 * Phase 2: Generate structured dream analysis using function calling.
	 * For new dreams (analysisVersion = 2).
	 */
	public async analyzeWithStructuredOutput(
		dreamId: string,
		userId: string,
		signal?: AbortSignal
	): Promise<void> {
		const prisma = await getPrismaClient();

		const dream = await prisma.dream.findUnique({
			where: { id: dreamId },
			include: { user: true }
		});

		if (!dream) throw new Error('Dream not found');

		// Build context (metadata + past dreams)
		const { metadataContext, pastDreamsContext } = await dreamService.buildAnalysisContext(
			dreamId,
			userId
		);

		const promptConfig = await this.getPromptForType(dream.promptType || 'jungian');

		// Generate structured analysis
		const structuredAnalysis =
			await this.llmService.generateStructuredAnalysis<StructuredDreamAnalysis>(
				promptConfig.systemPrompt,
				dream.rawText,
				pastDreamsContext,
				metadataContext,
				STRUCTURED_ANALYSIS_FUNCTION_SCHEMA,
				signal
			);

		// Save to database
		await prisma.dream.update({
			where: { id: dreamId },
			data: {
				structuredAnalysis: structuredAnalysis as Record<string, unknown>,
				analysisVersion: 2,
				status: 'COMPLETED',
				// Also save markdown version for backward compatibility
				interpretation: this.convertStructuredToMarkdown(structuredAnalysis)
			}
		});

		// Extract and store symbols (using detectedSymbols from structured output)
		await this.storeExtractedSymbolsFromStructured(dreamId, structuredAnalysis.detectedSymbols);
	}

	/**
	 * Phase 2: Convert structured analysis to markdown for backward compatibility.
	 * Used for: RSS feeds, exports, legacy views.
	 */
	private convertStructuredToMarkdown(analysis: StructuredDreamAnalysis): string {
		let markdown = `# ${analysis.primaryTheme}\n\n`;
		markdown += `**Summary:** ${analysis.summary}\n\n`;
		markdown += `**Emotional Tone:** ${analysis.emotionalTone}\n\n`;

		for (const block of analysis.analysisBlocks) {
			markdown += `## ${block.title}\n\n${block.content}\n\n`;
		}

		markdown += `## Integration Suggestions\n\n`;
		analysis.integrationSuggestions.forEach((suggestion, i) => {
			markdown += `${i + 1}. ${suggestion}\n`;
		});

		return markdown;
	}

	/**
	 * Phase 2: Determine if dream should use structured analysis (version 2).
	 * All new dreams (created after Phase 2 launch) use structured analysis.
	 */
	private shouldUseStructuredAnalysis(dream: { createdAt: Date }): boolean {
		// Use structured analysis for all new dreams
		// This can be adjusted based on a cutoff date or feature flag
		return true;
	}

	/**
	 * Phase 2: Store symbols from structured analysis output.
	 */
	private async storeExtractedSymbolsFromStructured(
		dreamId: string,
		detectedSymbols: StructuredDreamAnalysis['detectedSymbols']
	): Promise<void> {
		try {
			const { symbolService } = await import('./services');

			await symbolService.bulkCreateOccurrences(
				dreamId,
				detectedSymbols.map((s) => ({
					name: s.name,
					sentiment: s.sentiment,
					contextNote: s.contextNote,
					prominence: s.prominence
				}))
			);

			console.log(`Stored ${detectedSymbols.length} symbols for dream ${dreamId}`);
		} catch (error) {
			// Log but don't throw - symbol extraction is non-critical
			console.error(`Failed to store symbols for dream ${dreamId}:`, error);
		}
	}

	// ========== Phase 1: Symbol Extraction Methods ==========

	/**
	 * Extracts symbolic elements from a dream interpretation using LLM.
	 * Returns structured data for creating DreamSymbolOccurrences.
	 * @param interpretation The dream interpretation text.
	 * @param signal An AbortSignal to cancel the LLM request.
	 * @returns Array of extracted symbols with sentiment and context.
	 */
	public async extractSymbolsFromInterpretation(
		interpretation: string,
		signal?: AbortSignal
	): Promise<
		Array<{
			name: string;
			sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'AMBIVALENT';
			contextNote: string;
			prominence: number;
		}>
	> {
		const extractionPrompt = `Analyze this dream interpretation and extract the key symbolic elements.

Interpretation:
"""${interpretation.substring(0, 1500)}"""

Extract 3-8 symbolic elements (archetypes, recurring objects, significant places, emotional themes). For each symbol, provide:
- name: The symbol name (e.g., "Water", "Snake", "Mother Figure")
- sentiment: POSITIVE, NEUTRAL, NEGATIVE, or AMBIVALENT
- contextNote: Brief description (max 200 chars) of how it appeared
- prominence: 1 (background mention), 2 (secondary element), or 3 (central theme)

Return ONLY a JSON array in this exact format:
[
  {
    "name": "Water",
    "sentiment": "NEGATIVE",
    "contextNote": "Dark turbulent ocean causing fear",
    "prominence": 3
  }
]

Do not include any other text before or after the JSON.`;

		try {
			const response = await this.llmService.generateText(extractionPrompt, signal);

			// Try to parse the JSON response
			const jsonMatch = response.match(/\[[\s\S]*\]/);
			if (!jsonMatch) {
				console.warn('No JSON array found in symbol extraction response');
				return [];
			}

			const symbols = JSON.parse(jsonMatch[0]);

			// Validate and normalize the extracted symbols
			return symbols
				.filter((s: Record<string, unknown>) => s.name && typeof s.name === 'string')
				.map((s: Record<string, unknown>) => ({
					name: s.name as string,
					sentiment: ['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'AMBIVALENT'].includes(
						s.sentiment as string
					)
						? (s.sentiment as 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'AMBIVALENT')
						: 'NEUTRAL',
					contextNote: (s.contextNote as string)?.substring(0, 200) || `Symbol: ${s.name}`,
					prominence: [1, 2, 3].includes(s.prominence as number) ? (s.prominence as number) : 2
				}));
		} catch (error) {
			console.error('Error extracting symbols from interpretation:', error);
			return []; // Return empty array on failure - symbol extraction is non-critical
		}
	}

	/**
	 * Background task to extract and store symbols after dream analysis completes.
	 * This should be called after the stream finishes and interpretation is saved.
	 * @param dreamId The dream ID.
	 * @param interpretation The saved interpretation text.
	 */
	public async storeExtractedSymbols(dreamId: string, interpretation: string): Promise<void> {
		try {
			// Dynamically import to avoid circular dependencies
			const { symbolService } = await import('./services');

			// Extract symbols
			const symbols = await this.extractSymbolsFromInterpretation(interpretation);

			if (symbols.length === 0) {
				console.log(`No symbols extracted for dream ${dreamId}`);
				return;
			}

			// Store symbols
			await symbolService.bulkCreateOccurrences(dreamId, symbols);

			console.log(`Stored ${symbols.length} symbols for dream ${dreamId}`);
		} catch (error) {
			// Log but don't throw - symbol extraction is non-critical
			console.error(`Failed to store symbols for dream ${dreamId}:`, error);
		}
	}
}

let dreamAnalysisServiceInstance: DreamAnalysisService;

export function getDreamAnalysisService(): DreamAnalysisService {
	if (!dreamAnalysisServiceInstance) {
		dreamAnalysisServiceInstance = new DreamAnalysisService();
	}
	return dreamAnalysisServiceInstance;
}
