import type { Dream, PrismaClient } from '@prisma/client';
import type { DreamPromptType } from '$lib/promptTypes';
import { promptService } from '$lib/server/prompts/promptService';
import { getLLMService, type ChatMessage } from '$lib/server/llmService';
import { getPrismaClient } from '$lib/server/db';

/**
 * Producing an interpretation for a dream.
 *
 * Split from related-dream discovery, which now lives in relatedDreams.ts. This
 * module only builds the prompt and returns the LLM stream; StreamProcessor owns
 * what happens to the tokens.
 */

/** A short evocative title, from the cheaper model. */
export async function generateDreamTitle(dreamText: string, signal?: AbortSignal): Promise<string> {
	const titlePrompt = `Create a very short, evocative title (under 10 words) for the following dream. Focus on the most prominent image or feeling. Use the same language as the dream text. Do not respond anything besides the dream's title.
Dream: "${dreamText}"
Title:`;

	try {
		const title = await getLLMService().generateText(titlePrompt, signal);
		// The model sometimes wraps its answer in quotes.
		return title.trim().replace(/^"|"$/g, '');
	} catch (error) {
		console.error('Error generating dream title:', error);
		return 'Untitled Dream';
	}
}

/**
 * Starts the analysis stream for a dream, using its already-linked related
 * dreams as context.
 *
 * Related dreams and the title are expected to have been set BEFORE this is
 * called - see findAndSetRelatedDreams.
 */
export async function initiateDreamAnalysis(
	dream: Dream,
	promptType: DreamPromptType = 'jungian',
	signal?: AbortSignal,
	prisma: PrismaClient = getPrismaClient()
): Promise<AsyncIterable<string>> {
	// Re-read so the context reflects relations written moments ago.
	const withRelations = await prisma.dream.findUnique({
		where: { id: dream.id },
		select: {
			id: true,
			relatedTo: { select: { id: true, title: true, dreamDate: true, rawText: true } }
		}
	});

	if (!withRelations) {
		throw new Error(`Dream with ID ${dream.id} not found for analysis context.`);
	}

	let pastDreamsContext = '';
	if (withRelations.relatedTo.length > 0) {
		pastDreamsContext =
			`Here are some of my past dreams for context:\n` +
			withRelations.relatedTo
				.map(
					(d) =>
						`- ${d.title} (Date: ${d.dreamDate.toLocaleDateString()}):\nRaw Text: """${d.rawText}"""`
				)
				.join('\n');
	}

	const messages: ChatMessage[] = [
		{ role: 'system', content: promptService.getSystemPrompt(promptType) },
		{
			role: 'user',
			content:
				(pastDreamsContext ? `${pastDreamsContext}\n\n` : '') + `My current dream: ${dream.rawText}`
		}
	];

	try {
		return await getLLMService().streamChatCompletion(messages, signal);
	} catch (error) {
		console.error(`Error initiating LLM stream for dream ${dream.id}:`, error);
		throw error;
	}
}
