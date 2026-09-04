import { fail, redirect } from '@sveltejs/kit';
import { getPrismaClient } from '$lib/server/db';
import * as v from 'valibot';
import type { PageServerLoad, Actions } from './$types';
import { error, isHttpError, isRedirect } from '@sveltejs/kit';
import { DreamStatus } from '@prisma/client'; // Import the Prisma DreamStatus enum
import { claimAnalysis, costOf, getCreditsBalance } from '$lib/server/credits';
import { generateDreamTitle } from '$lib/server/analysis';
import { findAndSetRelatedDreams } from '$lib/server/relatedDreams';
import { extractDreamElements, ensureDreamElements } from '$lib/server/elements';
import { buildTsQueryFromRaw, dreamSearchFilter } from '$lib/server/search/tsquery';
import { dreamAction } from '$lib/server/guards';

/** Shared by the two actions that return a dream plus its relations. */
const DREAM_WITH_RELATIONS = {
	id: true,
	rawText: true,
	title: true,
	interpretation: true,
	status: true,
	dreamDate: true,
	createdAt: true,
	updatedAt: true,
	promptType: true,
	relatedTo: { select: { id: true, title: true, dreamDate: true, rawText: true } }
} as const;

// Schemas for validation
const UpdateDreamSchema = v.object({
	rawText: v.pipe(v.string(), v.minLength(10, 'Dream text must be at least 10 characters long.'))
});

const UpdateInterpretationSchema = v.object({
	interpretation: v.pipe(
		v.string(),
		v.minLength(10, 'Interpretation must be at least 10 characters long.')
	)
});

const UpdateDreamDateSchema = v.object({
	dreamDate: v.pipe(
		v.string(),
		v.check((s) => !isNaN(new Date(s).getTime()), 'Invalid date format')
	)
});

const UpdateTitleSchema = v.object({
	title: v.pipe(v.string(), v.minLength(3, 'Title must be at least 3 characters long.'))
});

const UpdateRelatedDreamsSchema = v.object({
	relatedDreamIds: v.pipe(
		v.string(),
		v.transform((s) => JSON.parse(s) as string[])
	)
});

const RemoveRelatedDreamSchema = v.object({
	relatedDreamId: v.pipe(v.string(), v.minLength(1, 'Related dream ID is required.'))
});

const ResetAnalysisSchema = v.object({
	promptType: v.string() // Expect promptType from the form
});

const SearchDreamsSchema = v.object({
	query: v.pipe(v.string(), v.minLength(3, 'Search query must be at least 3 characters long.'))
});

export const load: PageServerLoad = async ({ params, locals }) => {
	const dreamId = params.id;
	const sessionUser = locals.user;

	if (!sessionUser) {
		throw redirect(302, '/login');
	}

	if (!dreamId) {
		throw error(400, 'Dream ID is required.');
	}

	const prisma = await getPrismaClient();

	try {
		const dream = await prisma.dream.findUnique({
			where: {
				id: dreamId,
				userId: sessionUser.id
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
				analysisPaidAt: true,
				promptType: true, // Select promptType
				elements: {
					select: {
						rawLabel: true,
						valence: true,
						note: true,
						entry: { select: { id: true, kind: true, label: true } }
					}
				},
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

		if (!dream) {
			throw error(404, 'Dream not found.');
		}

		// How many of this dreamer's dreams use each entry, so a badge can read
		// "eau x12" rather than implying tonight was the only time.
		// ponytail: one groupBy per detail load, and it filters on a non-PK join
		// (dream_element -> vocabulary_entry.user_id). Fine at a few thousand rows
		// per user; past ~50k, denormalise user_id onto dream_element.
		const entryIds = dream.elements.map((e) => e.entry.id);
		const elementCounts = Object.fromEntries(
			entryIds.length
				? (
						await prisma.dreamElement.groupBy({
							by: ['entryId'],
							where: { entryId: { in: entryIds } },
							_count: { entryId: true }
						})
					).map((g) => [g.entryId, g._count.entryId])
				: []
		);

		// Fetch next and previous dreams for navigation
		const nextDream = await prisma.dream.findFirst({
			where: {
				userId: sessionUser.id,
				dreamDate: {
					gte: dream.dreamDate // Use gte to include dreams on the same date, then order by createdAt
				},
				id: {
					not: dream.id // Exclude the current dream
				}
			},
			orderBy: [{ dreamDate: 'asc' }, { createdAt: 'asc' }],
			select: { id: true },
			take: 1
		});

		const prevDream = await prisma.dream.findFirst({
			where: {
				userId: sessionUser.id,
				dreamDate: {
					lte: dream.dreamDate // Use lte to include dreams on the same date, then order by createdAt
				},
				id: {
					not: dream.id // Exclude the current dream
				}
			},
			orderBy: [{ dreamDate: 'desc' }, { createdAt: 'desc' }],
			select: { id: true },
			take: 1
		});

		// A dream can sit PENDING_ANALYSIS with nothing paid for it - the user ran out
		// of credits at creation. The page has to offer to pay rather than silently
		// try to stream, so it needs the price and what they actually have.
		const unpaid = dream.status === 'PENDING_ANALYSIS' && dream.analysisPaidAt === null;

		return {
			dream,
			elementCounts,
			nextDreamId: nextDream?.id || null,
			prevDreamId: prevDream?.id || null,
			unpaid,
			analysisCost: costOf('DREAM_ANALYSIS'),
			creditsBalance: unpaid ? await getCreditsBalance(sessionUser.id) : null
		};
	} catch (e) {
		// error() signals by throwing, so the 404 raised above lands here; without
		// this it would be reported as a 500.
		if (isHttpError(e) || isRedirect(e)) throw e;
		console.error(`Error fetching dream ${dreamId}:`, e);
		error(500, 'Failed to fetch dream.');
	}
};

export const actions: Actions = {
	updateDream: dreamAction('update dream', async ({ dream, formData }) => {
		const { rawText } = v.parse(UpdateDreamSchema, { rawText: formData.get('rawText') });
		return {
			success: true,
			dream: await getPrismaClient().dream.update({
				where: { id: dream.id },
				data: { rawText, updatedAt: new Date() }
			})
		};
	}),

	updateInterpretation: dreamAction('update interpretation', async ({ dream, formData }) => {
		const { interpretation } = v.parse(UpdateInterpretationSchema, {
			interpretation: formData.get('interpretation')
		});
		return {
			success: true,
			dream: await getPrismaClient().dream.update({
				where: { id: dream.id },
				data: { interpretation, updatedAt: new Date() }
			})
		};
	}),

	updateDreamDate: dreamAction('update dream date', async ({ dream, formData }) => {
		const { dreamDate } = v.parse(UpdateDreamDateSchema, { dreamDate: formData.get('dreamDate') });
		return {
			success: true,
			dream: await getPrismaClient().dream.update({
				where: { id: dream.id },
				data: { dreamDate: new Date(dreamDate) }
			})
		};
	}),

	updateTitle: dreamAction('update title', async ({ dream, formData }) => {
		const { title } = v.parse(UpdateTitleSchema, { title: formData.get('title') });
		return {
			success: true,
			dream: await getPrismaClient().dream.update({
				where: { id: dream.id },
				data: { title, updatedAt: new Date() }
			})
		};
	}),

	regenerateTitle: dreamAction('regenerate title', async ({ dream }) => {
		const title = await generateDreamTitle(dream.rawText);
		return {
			success: true,
			dream: await getPrismaClient().dream.update({
				where: { id: dream.id },
				data: { title, updatedAt: new Date() }
			})
		};
	}),

	updateRelatedDreams: dreamAction('update related dreams', async ({ dream, formData }) => {
		const { relatedDreamIds } = v.parse(UpdateRelatedDreamsSchema, {
			relatedDreamIds: formData.get('relatedDreamIds')
		});
		const prisma = getPrismaClient();

		// Clear both directions first: the relation is symmetric, so leaving
		// relatedBy in place would resurrect links the user just removed.
		await prisma.dream.update({
			where: { id: dream.id },
			data: { relatedTo: { set: [] }, relatedBy: { set: [] } }
		});

		return {
			success: true,
			dream: await prisma.dream.update({
				where: { id: dream.id },
				data: {
					relatedTo: { connect: relatedDreamIds.map((id) => ({ id })) },
					updatedAt: new Date()
				},
				select: DREAM_WITH_RELATIONS
			})
		};
	}),

	removeRelatedDream: dreamAction('remove related dream', async ({ dream, formData }) => {
		const { relatedDreamId } = v.parse(RemoveRelatedDreamSchema, {
			relatedDreamId: formData.get('relatedDreamId')
		});
		return {
			success: true,
			dream: await getPrismaClient().dream.update({
				where: { id: dream.id },
				data: { relatedTo: { disconnect: { id: relatedDreamId } } },
				select: DREAM_WITH_RELATIONS
			})
		};
	}),

	regenerateRelatedDreams: dreamAction('regenerate related dreams', async ({ dream }) => {
		// The free, user-reachable repair for a dream that has no elements - the
		// only such path, since reextract runs from a workstation and
		// ?/resetAnalysis charges a credit.
		//
		// FILL-ONLY on purpose. This action is free and unrate-limited (CLAUDE.md
		// names it), so unconditional extraction would make it the costliest
		// endpoint in the app; and because extraction is delete-then-insert it
		// would also destroy post-pass notes the user paid for.
		await ensureDreamElements(dream);
		return { success: true, dream: await findAndSetRelatedDreams(dream) };
	}),

	searchDreams: dreamAction('search dreams', async ({ dream, user, formData }) => {
		const { query } = v.parse(SearchDreamsSchema, { query: formData.get('query') });

		const safeSearchQuery = buildTsQueryFromRaw(query);
		if (!safeSearchQuery) return { success: true, dreams: [] };

		const dreams = await getPrismaClient().dream.findMany({
			where: {
				userId: user.id,
				id: { not: dream.id },
				OR: dreamSearchFilter(safeSearchQuery)
			},
			select: { id: true, title: true, rawText: true, dreamDate: true },
			take: 10
		});

		return { success: true, dreams };
	}),

	deleteDream: dreamAction('delete dream', async ({ dream }) => {
		await getPrismaClient().dream.delete({ where: { id: dream.id } });
		// Outside any try here; the wrapper re-throws redirects rather than
		// reporting them as failures.
		redirect(303, '/dreams');
	}),

	resetAnalysis: dreamAction('reset analysis', async ({ dream, user, formData }) => {
		const { promptType } = v.parse(ResetAnalysisSchema, { promptType: formData.get('promptType') });
		const prisma = getPrismaClient();

		// Pay BEFORE doing the work. This previously checked credits, ran two LLM
		// calls, and only then charged - so a charge that failed left the work done
		// and unpaid, reported as a generic 500.
		const claim = await claimAnalysis(dream, user.id);
		if (claim === 'insufficient') {
			return fail(402, {
				reason: 'insufficient_credits',
				analysisCost: costOf('DREAM_ANALYSIS'),
				creditsBalance: await getCreditsBalance(user.id)
			});
		}

		let updated = await prisma.dream.update({
			where: { id: dream.id },
			data: {
				status: DreamStatus.PENDING_ANALYSIS,
				interpretation: null,
				promptType,
				updatedAt: new Date()
			}
		});

		// These three are best-effort. Unlike the create path this action had no
		// try, so any throw here became `fail(500)` via dreamAction - AFTER the
		// user was charged and `interpretation` was nulled. Adding two LLM calls
		// to the path made that worth fixing rather than inheriting.
		try {
			updated = await prisma.dream.update({
				where: { id: updated.id },
				data: { title: await generateDreamTitle(updated.rawText) }
			});
			// Before relations: overlap retrieval reads what extraction writes.
			await extractDreamElements(updated);
			updated = await findAndSetRelatedDreams(updated);
		} catch (e) {
			console.error(`Dream ${updated.id}: title/elements/relations failed on reset:`, e);
		}

		return { success: true, dream: updated };
	})
};
