import { fail, redirect } from '@sveltejs/kit';
import { getPrismaClient } from '$lib/server/db';
import * as v from 'valibot';
import type { PageServerLoad, Actions } from './$types';
import { error, isHttpError, isRedirect } from '@sveltejs/kit';
import { DreamStatus } from '@prisma/client'; // Import the Prisma DreamStatus enum
import { getCreditService } from '$lib/server/creditService'; // Import credit service
import { getDreamAnalysisService } from '$lib/server/dreamAnalysisService';
import { buildTsQueryFromRaw } from '$lib/server/search/tsquery';
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

const UpdateStatusSchema = v.object({
	status: v.picklist([
		DreamStatus.PENDING_ANALYSIS,
		DreamStatus.COMPLETED,
		DreamStatus.ANALYSIS_FAILED
	])
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
				tags: true,
				dreamDate: true,
				createdAt: true,
				updatedAt: true,
				promptType: true, // Select promptType
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

		// Ensure tags are parsed correctly if stored as JSON string
		const dreamWithParsedTags = {
			...dream,
			tags: dream.tags ? (dream.tags as string[]) : null
		};

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

		return {
			dream: dreamWithParsedTags,
			nextDreamId: nextDream?.id || null,
			prevDreamId: prevDream?.id || null
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
		const title = await getDreamAnalysisService().generateDreamTitle(dream.rawText);
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
		return { success: true, dream: await getDreamAnalysisService().findAndSetRelatedDreams(dream) };
	}),

	searchDreams: dreamAction('search dreams', async ({ dream, user, formData }) => {
		const { query } = v.parse(SearchDreamsSchema, { query: formData.get('query') });

		const safeSearchQuery = buildTsQueryFromRaw(query);
		if (!safeSearchQuery) return { success: true, dreams: [] };

		const dreams = await getPrismaClient().dream.findMany({
			where: {
				userId: user.id,
				id: { not: dream.id },
				OR: [
					{ title: { search: safeSearchQuery } },
					{ rawText: { search: safeSearchQuery } },
					{ interpretation: { search: safeSearchQuery } }
				]
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
		const creditService = getCreditService();
		const dreamAnalysisService = getDreamAnalysisService();

		const cost = creditService.getCost('DREAM_ANALYSIS');
		if (!(await creditService.checkCredits(user.id, cost))) {
			return fail(402, {
				error: 'Insufficient credits for dream analysis or daily limit exceeded.'
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

		updated = await prisma.dream.update({
			where: { id: updated.id },
			data: { title: await dreamAnalysisService.generateDreamTitle(updated.rawText) }
		});
		updated = await dreamAnalysisService.findAndSetRelatedDreams(updated);

		await creditService.deductCredits(user.id, cost, 'DREAM_ANALYSIS', updated.id);

		return { success: true, message: 'Dream status reset to PENDING_ANALYSIS.', dream: updated };
	}),

	updateStatus: dreamAction('update status', async ({ dream, formData }) => {
		const { status } = v.parse(UpdateStatusSchema, { status: formData.get('status') });
		return {
			success: true,
			dream: await getPrismaClient().dream.update({
				where: { id: dream.id },
				data: { status, updatedAt: new Date() }
			})
		};
	})
};
