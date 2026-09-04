import type { Dream, PrismaClient } from '@prisma/client';
import type { DreamPromptType } from '$lib/promptTypes';
import { promptService } from '$lib/server/prompts/promptService';
import { getLLMService, type ChatMessage } from '$lib/server/llmService';
import { buildElementHistory } from '$lib/server/elements';
import { getPrismaClient } from '$lib/server/db';
import {
	findRecentPastDreams,
	findDreamsSharingElements,
	SERIES_LENGTH
} from '$lib/server/relatedDreams';

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
 * Reads the two past-dream signals directly rather than through `relatedTo`,
 * which is a single undifferentiated bag that also grows on every regeneration.
 */
/**
 * How much past-dream text may reach the prompt.
 *
 * A CHARACTER budget, not a row count. `rawText` has no maximum anywhere
 * (validation is minLength(10) only), so "take 8 dreams" bounds nothing - eight
 * unbounded texts is still unbounded, and what actually stopped it before was
 * the provider rejecting the request.
 */
const PAST_DREAM_CHAR_BUDGET = 6_000;

/**
 * How many hand-curated relations reach the prompt.
 *
 * Bounded because `relatedTo` accumulates: findAndSetRelatedDreams connects
 * without clearing, deliberately, so that regenerating never deletes a link the
 * user made. That makes the relation grow monotonically, which is fine for a
 * badge list and not fine for a prompt.
 */
const CURATED_LIMIT = 5;

/** Trim a dream to fit the budget, marking the cut so the model knows it happened. */
function excerpt(text: string, budget: number): string {
	return text.length <= budget ? text : `${text.slice(0, budget)}[...]`;
}

/**
 * Builds the past-dream context as TWO distinct blocks.
 *
 * Keeping them apart is the point. A dream series is read as chapters - Jung's
 * own framing, and the reason the recent run is included whether or not it
 * shares a single symbol with tonight. Symbol echoes are a different signal: an
 * eighteen-month-old water dream, surfaced because the symbol recurred, with no
 * claim to being recent.
 *
 * Flattened into one undated bag (which is what `relatedTo` is) the model cannot
 * tell last Tuesday from last year, and neither reading survives.
 */
async function buildPastDreamsContext(dream: Dream, prisma: PrismaClient): Promise<string> {
	// Sequential on purpose: the echo query needs the series ids to exclude them,
	// and excluding after the fact would waste the echo budget on dreams the
	// prompt already shows.
	const [series, history] = await Promise.all([
		findRecentPastDreams(dream, SERIES_LENGTH, prisma),
		buildElementHistory(dream, prisma)
	]);
	const seriesIds = series.map((d) => d.id);
	const echoes = await findDreamsSharingElements(dream, 5, prisma, seriesIds);

	// Links the dreamer made by hand, which neither signal can rediscover.
	// Building the prompt from the two queries alone made ?/updateRelatedDreams
	// and ?/removeRelatedDream decorative: a user could curate a connection and a
	// paid re-analysis would ignore it. Curation outranks both automatic signals,
	// so these go first and are not subject to the echo budget's ranking.
	const curated = await prisma.dream.findUnique({
		where: { id: dream.id },
		select: { relatedTo: { select: { id: true }, take: CURATED_LIMIT } }
	});
	const curatedIds = (curated?.relatedTo ?? [])
		.map((d) => d.id)
		.filter((id) => !seriesIds.includes(id));

	const echoIds = [...new Set([...curatedIds, ...echoes.map((e) => e.id)])];

	const echoDreams = echoIds.length
		? await prisma.dream.findMany({
				where: { id: { in: echoIds } },
				select: { id: true, title: true, rawText: true, dreamDate: true }
			})
		: [];
	// findMany does not preserve `in` order; restore the intended ranking, with
	// curated links ahead of overlap matches.
	const rank = new Map(echoIds.map((id, i) => [id, i]));
	echoDreams.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));

	// The series gets the larger share: it is the spine of the reading.
	const seriesBudget = Math.floor(PAST_DREAM_CHAR_BUDGET * 0.6);
	const echoBudget = PAST_DREAM_CHAR_BUDGET - seriesBudget;
	const perSeries = series.length ? Math.floor(seriesBudget / series.length) : 0;
	const perEcho = echoDreams.length ? Math.floor(echoBudget / echoDreams.length) : 0;

	const blocks: string[] = [];

	// First, because it is the shortest and the most specific: counts and arcs
	// for the images actually in tonight's dream. Empty when nothing recurs, and
	// then omitted entirely - a heading with nothing under it invites the model
	// to invent entries beneath it.
	if (history) blocks.push(history);

	if (series.length) {
		blocks.push(
			`Here are some of my past dreams for context, oldest first:
` +
				series
					.map(
						(d) =>
							`- ${d.title ?? 'Untitled'} (${d.dreamDate.toLocaleDateString()}):
"""${excerpt(d.rawText, perSeries)}"""`
					)
					.join('\n')
		);
	}

	if (echoDreams.length) {
		blocks.push(
			`Older dreams of mine that return to the same images as tonight's:
` +
				echoDreams
					.map(
						(d) =>
							`- ${d.title ?? 'Untitled'} (${d.dreamDate.toLocaleDateString()}):
"""${excerpt(d.rawText, perEcho)}"""`
					)
					.join('\n')
		);
	}

	return blocks.join('\n\n');
}

export async function initiateDreamAnalysis(
	dream: Dream,
	promptType: DreamPromptType = 'jungian',
	signal?: AbortSignal,
	prisma: PrismaClient = getPrismaClient()
): Promise<AsyncIterable<string>> {
	const pastDreamsContext = await buildPastDreamsContext(dream, prisma);

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
