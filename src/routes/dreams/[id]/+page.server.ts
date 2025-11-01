import { fail, redirect } from '@sveltejs/kit';
import { getPrismaClient } from '$lib/server/db';
import * as v from 'valibot';
import type { PageServerLoad, Actions } from './$types';
import { error } from '@sveltejs/kit';
import { DreamStatus } from '@prisma/client'; // Import the Prisma DreamStatus enum
import { getCreditService } from '$lib/server/creditService'; // Import credit service
// Removed initiateTextToSpeech as it's no longer used directly in this action

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

const ResetAnalysisSchema = v.object({
	promptType: v.string() // Expect promptType from the form
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
	} catch (e: any) {
		console.error(`Error fetching dream ${dreamId}:`, e);
		if (e.status) {
			// Re-throw SvelteKit errors
			throw e;
		}
		throw error(500, 'Failed to fetch dream.');
	}
};

export const actions: Actions = {
	updateDream: async ({ request, params, locals }) => {
		const dreamId = params.id;
		const sessionUser = locals.user;
		if (!sessionUser) {
			return fail(401, { message: 'Unauthorized' });
		}

		const formData = await request.formData();
		const rawText = formData.get('rawText');

		let validatedData;
		try {
			validatedData = v.parse(UpdateDreamSchema, { rawText });
		} catch (e: any) {
			const issues = e.issues.map((issue: any) => issue.message);
			return fail(400, { rawText, error: issues.join(', ') });
		}

		const prisma = await getPrismaClient();

		try {
			const existingDream = await prisma.dream.findUnique({
				where: { id: dreamId }
			});

			if (!existingDream || existingDream.userId !== sessionUser.id) {
				return fail(403, { error: 'Forbidden: You do not own this dream or it does not exist.' });
			}

			const updatedDream = await prisma.dream.update({
				where: { id: dreamId },
				data: {
					rawText: validatedData.rawText,
					updatedAt: new Date()
				}
			});
			return { success: true, dream: updatedDream };
		} catch (e) {
			console.error('Error updating dream:', e);
			return fail(500, { rawText, error: 'Failed to update dream due to a server error.' });
		}
	},

	updateInterpretation: async ({ request, params, locals }) => {
		const dreamId = params.id;
		const sessionUser = locals.user;
		if (!sessionUser) {
			return fail(401, { message: 'Unauthorized' });
		}

		const formData = await request.formData();
		const interpretation = formData.get('interpretation');

		let validatedData;
		try {
			validatedData = v.parse(UpdateInterpretationSchema, { interpretation });
		} catch (e: any) {
			const issues = e.issues.map((issue: any) => issue.message);
			return fail(400, { interpretation, error: issues.join(', ') });
		}

		const prisma = await getPrismaClient();

		try {
			const existingDream = await prisma.dream.findUnique({
				where: { id: dreamId }
			});

			if (!existingDream || existingDream.userId !== sessionUser.id) {
				return fail(403, { error: 'Forbidden: You do not own this dream or it does not exist.' });
			}

			const updatedDream = await prisma.dream.update({
				where: { id: dreamId },
				data: {
					interpretation: validatedData.interpretation,
					updatedAt: new Date()
				}
			});
			return { success: true, dream: updatedDream };
		} catch (e) {
			console.error('Error updating dream interpretation:', e);
			return fail(500, {
				interpretation,
				error: 'Failed to update dream interpretation due to a server error.'
			});
		}
	},

	updateDreamDate: async ({ request, params, locals }) => {
		const dreamId = params.id;
		const sessionUser = locals.user;
		if (!sessionUser) {
			return fail(401, { message: 'Unauthorized' });
		}

		const formData = await request.formData();
		const dreamDate = formData.get('dreamDate');


		let validatedData;
		try {
			validatedData = v.parse(UpdateDreamDateSchema, { dreamDate });
		} catch (e: any) {
			const issues = e.issues.map((issue: any) => issue.message);
			return fail(400, { dreamDate, error: issues.join(', ') });
		}

		const prisma = await getPrismaClient();

		try {
			const existingDream = await prisma.dream.findUnique({
				where: { id: dreamId }
			});

			if (!existingDream || existingDream.userId !== sessionUser.id) {
				return fail(403, { error: 'Forbidden: You do not own this dream or it does not exist.' });
			}

			const updatedDream = await prisma.dream.update({
				where: { id: dreamId },
				data: {
					dreamDate: new Date(validatedData.dreamDate as string),
				}
			});
			return { success: true, dream: updatedDream };
		} catch (e) {
			console.error('Error updating dream date:', e);
			return fail(500, { dreamDate, error: 'Failed to update dream date due to a server error.' });
		}
	},

	deleteDream: async ({ params, locals }) => {
		const dreamId = params.id;
		const sessionUser = locals.user;
		if (!sessionUser) {
			return fail(401, { message: 'Unauthorized' });
		}

		const prisma = await getPrismaClient();

		try {
			const dream = await prisma.dream.findUnique({
				where: {
					id: dreamId,
					userId: sessionUser.id
				}
			});

			if (!dream) {
				return fail(404, { error: 'Dream not found or you do not have permission to delete it.' });
			}

			await prisma.dream.delete({
				where: {
					id: dreamId
				}
			});

			throw redirect(303, '/dreams');
		} catch (e: any) {
			console.error('Error deleting dream:', e);
			if (e.status === 303) {
				// Re-throw redirect
				throw e;
			}
			return fail(500, { error: 'Failed to delete dream.' });
		}
	},

	resetAnalysis: async ({ request, params, locals }) => {
		const dreamId = params.id;
		const sessionUser = locals.user;
		if (!sessionUser) {
			return fail(401, { message: 'Unauthorized' });
		}

		const prisma = await getPrismaClient();
		const creditService = getCreditService();

		const formData = await request.formData();
		const promptType = formData.get('promptType');

		let validatedData;
		try {
			validatedData = v.parse(ResetAnalysisSchema, { promptType });
		} catch (e: any) {
			const issues = e.issues.map((issue: any) => issue.message);
			return fail(400, { promptType, error: issues.join(', ') });
		}

		const dream = await prisma.dream.findUnique({
			where: { id: dreamId }
		});

		if (!dream || dream.userId !== sessionUser.id) {
			return fail(403, { error: 'Forbidden: Dream does not belong to user or does not exist.' });
		}

		try {
			// Check if the user has enough credits for a new analysis
			const cost = creditService.getCost('DREAM_ANALYSIS');
			const hasCredits = await creditService.checkCredits(sessionUser.id, cost);

			if (!hasCredits) {
				return fail(402, { error: 'Insufficient credits for dream analysis or daily limit exceeded.' });
			}

			const updatedDream = await prisma.dream.update({
				where: { id: dreamId },
				data: {
					status: DreamStatus.PENDING_ANALYSIS, // Use enum
					interpretation: null, // Clear previous interpretation
					promptType: validatedData.promptType, // Persist the selected promptType
					updatedAt: new Date()
				}
			});

			// Deduct credits for the new analysis
			await creditService.deductCredits(
				sessionUser.id,
				cost,
				'DREAM_ANALYSIS',
				updatedDream.id
			);

			return { success: true, message: 'Dream status reset to PENDING_ANALYSIS.', dream: updatedDream };
		} catch (e: any) {
			console.error(`Failed to reset dream status for ${dreamId}:`, e);
			return fail(500, { error: 'Failed to reset dream status.' });
		}
	},

	updateStatus: async ({ request, params, locals }) => {
		const dreamId = params.id;
		const sessionUser = locals.user;
		if (!sessionUser) {
			return fail(401, { message: 'Unauthorized' });
		}

		const formData = await request.formData();
		const status = formData.get('status');

		let validatedData;
		try {
			validatedData = v.parse(UpdateStatusSchema, { status });
		} catch (e: any) {
			const issues = e.issues.map((issue: any) => issue.message);
			return fail(400, { status, error: issues.join(', ') });
		}

		const prisma = await getPrismaClient();

		try {
			const existingDream = await prisma.dream.findUnique({
				where: { id: dreamId }
			});

			if (!existingDream || existingDream.userId !== sessionUser.id) {
				return fail(403, { error: 'Forbidden: You do not own this dream or it does not exist.' });
			}

			const updatedDream = await prisma.dream.update({
				where: { id: dreamId },
				data: {
					status: validatedData.status as DreamStatus, // Use enum
					updatedAt: new Date()
				}
			});
			return { success: true, dream: updatedDream };
		} catch (e) {
			console.error('Error updating dream status:', e);
			return fail(500, { status, error: 'Failed to update dream status due to a server error.' });
		}
	}
};
