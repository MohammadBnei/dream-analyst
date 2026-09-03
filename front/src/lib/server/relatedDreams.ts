import type { Dream, PrismaClient } from '@prisma/client';
import { getLLMService } from '$lib/server/llmService';
import { getPrismaClient } from '$lib/server/db';
import { buildTsQueryFromRaw, dreamSearchFilter } from '$lib/server/search/tsquery';

/**
 * Discovering which of a user's earlier dreams relate to a new one.
 *
 * Split out of DreamAnalysisService, which combined this with the analysis
 * prompt, title generation and the LLM stream in one 335-line class. Related-dream
 * discovery is full-text search seeded by an LLM keyword extraction; it shares
 * nothing with streaming an interpretation except the same user's dreams.
 */

const DREAM_WITH_RELATIONS = {
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
	relatedTo: { select: { id: true, title: true, dreamDate: true, rawText: true } }
} as const;

/** The user's three most recent other dreams. */
async function findRecentPastDreams(dream: Dream, prisma: PrismaClient) {
	try {
		return await prisma.dream.findMany({
			where: { userId: dream.userId, id: { not: dream.id } },
			orderBy: { dreamDate: 'desc' },
			take: 3,
			select: { id: true, rawText: true, dreamDate: true, status: true }
		});
	} catch (e) {
		console.warn(`Dream ${dream.id}: Failed to fetch recent dreams:`, e);
		return [];
	}
}

/**
 * Dreams that are textually similar, found by asking the weak model for keywords
 * and running those through Postgres full-text search.
 */
async function findRelevantPastDreams(
	dream: Dream,
	signal: AbortSignal | undefined,
	prisma: PrismaClient
): Promise<Partial<Dream>[]> {
	try {
		const keywordPrompt = `Given the following dream text, extract 10 distinct keywords or short phrases (2-3 words max) that best describe its core themes, objects, or emotions. These keywords will be used to search for similar dreams. Separate them with commas. Use the same language as the dream text. Do not respond with anything else than the keywords, separated by commas.
Example: "water,fire,mountain,shame"
Dream: "${dream.rawText}"
Keywords:`;

		const rawSearchTerms = await getLLMService().generateText(keywordPrompt, signal);

		// buildTsQueryFromRaw turns the (possibly multi-word) keywords into a valid
		// tsquery. Raw text must never reach to_tsquery: a bare space is a syntax
		// error, not an implicit operator.
		const searchQuery = buildTsQueryFromRaw(rawSearchTerms);
		if (searchQuery.length === 0) return [];

		return await prisma.dream.findMany({
			where: {
				userId: dream.userId,
				id: { not: dream.id },
				OR: dreamSearchFilter(searchQuery)
			},
			orderBy: { dreamDate: 'desc' },
			take: 5
		});
	} catch (e) {
		console.warn(`Dream ${dream.id}: Failed to fetch relevant past dreams:`, e);
		return [];
	}
}

/**
 * Links a dream to its related dreams: the three most recent, plus anything
 * textually similar, deduplicated.
 */
export async function findAndSetRelatedDreams(
	dream: Dream,
	signal?: AbortSignal,
	prisma: PrismaClient = getPrismaClient()
): Promise<Dream> {
	const [recent, relevant] = await Promise.allSettled([
		findRecentPastDreams(dream, prisma),
		findRelevantPastDreams(dream, signal, prisma)
	]);

	const related: Partial<Dream>[] = [];
	if (recent.status === 'fulfilled') related.push(...recent.value);
	if (relevant.status === 'fulfilled') {
		related.push(...relevant.value.filter((d) => !related.some((r) => r.id === d.id)));
	}

	const ids = related.map((d) => d.id).filter((id): id is string => Boolean(id));

	return prisma.dream.update({
		where: { id: dream.id },
		data: { relatedTo: { connect: ids.map((id) => ({ id })) }, updatedAt: new Date() },
		select: DREAM_WITH_RELATIONS
	});
}
