import type { Dream, PrismaClient } from '@prisma/client';
import { getPrismaClient } from '$lib/server/db';

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
	analysisPaidAt: true,
	dreamDate: true,
	createdAt: true,
	updatedAt: true,
	userId: true,
	promptType: true,
	// `analysisText` and `tags` are dead columns - nothing writes or reads them any
	// more. They stay in this select because the declared return type is `Dream`,
	// and Prisma only satisfies it if EVERY scalar is enumerated. They cannot be
	// dropped from the database either: Prisma never emits `SELECT *`, so during a
	// rolling deploy the still-serving old pod would 500 on every dream query.
	analysisText: true,
	tags: true,
	elementsExtractedAt: true,
	relatedTo: { select: { id: true, title: true, dreamDate: true, rawText: true } }
} as const;

/**
 * How many dreams make a "series". Jung reads dreams as chapters, so the recent
 * run matters as a SEQUENCE in its own right, not merely as a fallback for when
 * symbol overlap finds nothing.
 */
export const SERIES_LENGTH = 5;

/**
 * The user's most recent other dreams - the series.
 *
 * Returned OLDEST FIRST. The query has to sort descending to take the latest N,
 * but a series read backwards is not a series: the caller wants to see a
 * progression, and so does the model.
 */
export async function findRecentPastDreams(
	dream: Pick<Dream, 'id' | 'userId'>,
	take = SERIES_LENGTH,
	prisma: PrismaClient = getPrismaClient()
) {
	try {
		const latest = await prisma.dream.findMany({
			where: { userId: dream.userId, id: { not: dream.id } },
			orderBy: { dreamDate: 'desc' },
			take,
			select: { id: true, title: true, rawText: true, dreamDate: true, status: true }
		});
		return latest.reverse();
	} catch (e) {
		console.warn(`Dream ${dream.id}: Failed to fetch recent dreams:`, e);
		return [];
	}
}

/**
 * Past dreams that share vocabulary with this one, most overlap first.
 *
 * Replaces an LLM keyword hack: the weak model was asked to invent 10 keywords,
 * which were then run through Postgres full-text search. That cost a model call
 * per dream to approximate what the element rows now record exactly, and it
 * could only ever match on surface wording - `la mer` never found `l'océan`.
 *
 * These are the ECHOES: older dreams surfaced because a symbol recurs, which is
 * the whole point of canonicalising vocabulary. Deliberately NOT ordered by
 * date - an eighteen-month-old dream about water outranking last Tuesday's is
 * the desired behaviour here. Chronology is carried by findRecentPastDreams
 * instead, and the two are kept separate all the way into the prompt.
 *
 * ponytail: groupBy over this user's occurrences, fine at the corpus sizes this
 * app has (a few thousand rows per user). Upgrade path past ~50k: a raw CTE with
 * a HAVING count.
 */
export async function findDreamsSharingElements(
	dream: Pick<Dream, 'id' | 'userId'>,
	take = 5,
	prisma: PrismaClient = getPrismaClient(),
	/**
	 * Dreams already covered by the series. Excluded INSIDE the query, not after:
	 * filtering the result would spend the top-5 budget on dreams the prompt is
	 * already showing and silently drop the older, lower-ranked ones - which are
	 * the entire reason this function exists. Recent dreams share the most
	 * vocabulary with tonight, so the collision is the normal case, not an edge.
	 */
	exclude: string[] = []
): Promise<{ id: string; shared: number }[]> {
	try {
		const mine = await prisma.dreamElement.findMany({
			where: { dreamId: dream.id },
			select: { entryId: true }
		});
		if (!mine.length) return [];

		const overlap = await prisma.dreamElement.groupBy({
			by: ['dreamId'],
			where: {
				entryId: { in: mine.map((e) => e.entryId) },
				dreamId: { notIn: [dream.id, ...exclude] },
				dream: { userId: dream.userId }
			},
			_count: { dreamId: true },
			orderBy: { _count: { dreamId: 'desc' } },
			take
		});
		return overlap.map((o) => ({ id: o.dreamId, shared: o._count.dreamId }));
	} catch (e) {
		console.warn(`Dream ${dream.id}: Failed to fetch dreams sharing elements:`, e);
		return [];
	}
}

/**
 * Links a dream to its related dreams for the UI: the recent series plus the
 * symbol echoes, deduplicated.
 *
 * NOTE: this populates `relatedTo`, which is what the dream page renders. The
 * interpretation prompt no longer reads it - analysis.ts queries the two signals
 * itself so it can keep the series and the echoes apart, and so the prompt is
 * not at the mercy of a relation that grows on every regeneration.
 *
 * `connect` without clearing is deliberate. `set: []` would be the tidy fix for
 * that growth, but this function is reachable from ?/regenerateRelatedDreams,
 * which is free and unrate-limited, and clearing there would silently delete
 * links the user curated by hand.
 */
export async function findAndSetRelatedDreams(
	dream: Dream,
	prisma: PrismaClient = getPrismaClient()
): Promise<Dream> {
	const [recent, echoes] = await Promise.allSettled([
		findRecentPastDreams(dream, SERIES_LENGTH, prisma),
		findDreamsSharingElements(dream, 5, prisma)
	]);

	const related: Partial<Dream>[] = [];
	if (recent.status === 'fulfilled') related.push(...recent.value);
	if (echoes.status === 'fulfilled') {
		related.push(...echoes.value.filter((d) => !related.some((r) => r.id === d.id)));
	}

	const ids = related.map((d) => d.id).filter((id): id is string => Boolean(id));

	return prisma.dream.update({
		where: { id: dream.id },
		data: { relatedTo: { connect: ids.map((id) => ({ id })) }, updatedAt: new Date() },
		select: DREAM_WITH_RELATIONS
	});
}
