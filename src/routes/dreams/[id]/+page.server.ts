import { fail, redirect } from '@sveltejs/kit';
import { getPrismaClient } from '$lib/server/db';
import * as v from 'valibot';
import type { PageServerLoad, Actions } from './$types';
import { error, json } from '@sveltejs/kit'; // Import json
import { DreamStatus } from '@prisma/client'; // Import the Prisma DreamStatus enum
import { getCreditService } from '$lib/server/creditService'; // Import credit service
import { getDreamAnalysisService } from '$lib/server/dreamAnalysisService'; // Import dream analysis service

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
	relatedDreamIds: v.pipe(v.string(), v.transform((s) => JSON.parse(s) as string[]))
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

export const load: PageServerLoad = async ({ params, locals, url }) => {
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
			tags: (dream as any).tags ? ((dream as any).tags as string[]) : []
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
					dreamDate: new Date(validatedData.dreamDate as string)
				}
			});
			return { success: true, dream: updatedDream };
		} catch (e) {
			console.error('Error updating dream date:', e);
			return fail(500, { dreamDate, error: 'Failed to update dream date due to a server error.' });
		}
	},

	updateTitle: async ({ request, params, locals }) => {
		const dreamId = params.id;
		const sessionUser = locals.user;
		if (!sessionUser) {
			return fail(401, { message: 'Unauthorized' });
		}

		const formData = await request.formData();
		const title = formData.get('title');

		let validatedData;
		try {
			validatedData = v.parse(UpdateTitleSchema, { title });
		} catch (e: any) {
			const issues = e.issues.map((issue: any) => issue.message);
			return fail(400, { title, error: issues.join(', ') });
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
					title: validatedData.title,
					updatedAt: new Date()
				}
			});
			return { success: true, dream: updatedDream };
		} catch (e) {
			console.error('Error updating dream title:', e);
			return fail(500, { title, error: 'Failed to update dream title due to a server error.' });
		}
	},

	regenerateTitle: async ({ params, locals }) => {
		const dreamId = params.id;
		const sessionUser = locals.user;
		if (!sessionUser) {
			return fail(401, { message: 'Unauthorized' });
		}

		const prisma = await getPrismaClient();
		const dreamAnalysisService = getDreamAnalysisService();

		try {
			const existingDream = await prisma.dream.findUnique({
				where: { id: dreamId }
			});

			if (!existingDream || existingDream.userId !== sessionUser.id) {
				return fail(403, { error: 'Forbidden: You do not own this dream or it does not exist.' });
			}

			const generatedTitle = await dreamAnalysisService.generateDreamTitle(existingDream.rawText);

			const updatedDream = await prisma.dream.update({
				where: { id: dreamId },
				data: {
					title: generatedTitle,
					updatedAt: new Date()
				}
			});
			return { success: true, dream: updatedDream };
		} catch (e) {
			console.error('Error regenerating dream title:', e);
			return fail(500, { error: 'Failed to regenerate dream title due to a server error.' });
		}
	},

	updateRelatedDreams: async ({ request, params, locals }) => {
		const dreamId = params.id;
		const sessionUser = locals.user;
		if (!sessionUser) {
			return fail(401, { message: 'Unauthorized' });
		}

		const formData = await request.formData();
		const relatedDreamIdsString = formData.get('relatedDreamIds');

		let validatedData;
		try {
			validatedData = v.parse(UpdateRelatedDreamsSchema, { relatedDreamIds: relatedDreamIdsString });
		} catch (e: any) {
			const issues = e.issues.map((issue: any) => issue.message);
			return fail(400, { relatedDreamIds: relatedDreamIdsString, error: issues.join(', ') });
		}

		const prisma = await getPrismaClient();

		try {
			const existingDream = await prisma.dream.findUnique({
				where: { id: dreamId }
			});

			if (!existingDream || existingDream.userId !== sessionUser.id) {
				return fail(403, { error: 'Forbidden: You do not own this dream or it does not exist.' });
			}

			// Disconnect all existing related dreams
			await prisma.dream.update({
				where: { id: dreamId },
				data: {
					relatedTo: {
						set: [] // Disconnect all
					},
					relatedBy: {
						set: [] // Disconnect all inverse relations
					}
				}
			});

			// Connect new related dreams
			const updatedDream = await prisma.dream.update({
				where: { id: dreamId },
				data: {
					relatedTo: {
						connect: validatedData.relatedDreamIds.map((id) => ({ id }))
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
					promptType: true,
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
			return { success: true, dream: updatedDream };
		} catch (e) {
			console.error('Error updating related dreams:', e);
			return fail(500, {
				relatedDreamIds: relatedDreamIdsString,
				error: 'Failed to update related dreams due to a server error.'
			});
		}
	},

	removeRelatedDream: async ({ request, params, locals }) => {
		const dreamId = params.id;
		const sessionUser = locals.user;
		if (!sessionUser) {
			return fail(401, { message: 'Unauthorized' });
		}

		const formData = await request.formData();
		const relatedDreamId = formData.get('relatedDreamId');

		let validatedData;
		try {
			validatedData = v.parse(RemoveRelatedDreamSchema, { relatedDreamId });
		} catch (e: any) {
			const issues = e.issues.map((issue: any) => issue.message);
			return fail(400, { relatedDreamId, error: issues.join(', ') });
		}

		const prisma = await getPrismaClient();

		try {
			const existingDream = await prisma.dream.findUnique({
				where: { id: dreamId }
			});

			if (!existingDream || existingDream.userId !== sessionUser.id) {
				return fail(403, { error: 'Forbidden: You do not own this dream or it does not exist.' });
			}

			// Disconnect the specific related dream
			const updatedDream = await prisma.dream.update({
				where: { id: dreamId },
				data: {
					relatedTo: {
						disconnect: { id: validatedData.relatedDreamId }
					}
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
					promptType: true,
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
			return { success: true, dream: updatedDream };
		} catch (e) {
			console.error('Error removing related dream:', e);
			return fail(500, {
				relatedDreamId,
				error: 'Failed to remove related dream due to a server error.'
			});
		}
	},

	regenerateRelatedDreams: async ({ params, locals }) => {
		const dreamId = params.id;
		const sessionUser = locals.user;
		if (!sessionUser) {
			return fail(401, { message: 'Unauthorized' });
		}

		const prisma = await getPrismaClient();
		const dreamAnalysisService = getDreamAnalysisService();

		try {
			const existingDream = await prisma.dream.findUnique({
				where: { id: dreamId }
			});

			if (!existingDream || existingDream.userId !== sessionUser.id) {
				return fail(403, { error: 'Forbidden: You do not own this dream or it does not exist.' });
			}

			const updatedDream = await dreamAnalysisService.findAndSetRelatedDreams(existingDream);

			return { success: true, dream: updatedDream };
		} catch (e) {
			console.error('Error regenerating related dreams:', e);
			return fail(500, { error: 'Failed to regenerate related dreams due to a server error.' });
		}
	},

	searchDreams: async ({ request, params, locals }) => {
		const dreamId = params.id;
		const sessionUser = locals.user;
		if (!sessionUser) {
			return fail(401, { message: 'Unauthorized' });
		}

		const formData = await request.formData();
		const query = formData.get('query');

		let validatedData;
		try {
			validatedData = v.parse(SearchDreamsSchema, { query });
		} catch (e: any) {
			const issues = e.issues.map((issue: any) => issue.message);
			return fail(400, { query, error: issues.join(', ') });
		}

		const prisma = await getPrismaClient();

		try {
			const safeSearchQuery = validatedData.query.trim().replaceAll(' ', '|');

			const dreams = await prisma.dream.findMany({
				where: {
					userId: sessionUser.id,
					id: { not: dreamId }, // Exclude the current dream
					OR: [
						{ title: { search: safeSearchQuery, mode: 'insensitive' } }, // Use 'search' for full-text search
						{ rawText: { search: safeSearchQuery, mode: 'insensitive' } }, // Use 'search' for full-text search
						{ interpretation: { search: safeSearchQuery, mode: 'insensitive' } } // Use 'search' for full-text search
					]
				},
				select: {
					id: true,
					title: true,
					rawText: true,
					dreamDate: true
				},
				take: 10 // Limit search results
			});

			return { success: true, dreams };
		} catch (e) {
			console.error('Error searching dreams:', e);
			return fail(500, { query, error: 'Failed to search dreams due to a server error.' });
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
		const dreamAnalysisService = getDreamAnalysisService(); // Get the service

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
				return fail(402, {
					error: 'Insufficient credits for dream analysis or daily limit exceeded.'
				});
			}

			// Regenerate title and related dreams before resetting analysis
			let updatedDream = await prisma.dream.update({
				where: { id: dreamId },
				data: {
					status: DreamStatus.PENDING_ANALYSIS, // Use enum
					interpretation: null, // Clear previous interpretation
					promptType: validatedData.promptType, // Persist the selected promptType
					updatedAt: new Date()
				}
			});

			// 1. Generate Title
			const generatedTitle = await dreamAnalysisService.generateDreamTitle(updatedDream.rawText);
			updatedDream = await prisma.dream.update({
				where: { id: updatedDream.id },
				data: { title: generatedTitle }
			});

			// 2. Find and Set Related Dreams
			updatedDream = await dreamAnalysisService.findAndSetRelatedDreams(updatedDream);

			// Deduct credits for the new analysis
			await creditService.deductCredits(sessionUser.id, cost, 'DREAM_ANALYSIS', updatedDream.id);

			return {
				success: true,
				message: 'Dream status reset to PENDING_ANALYSIS.',
				dream: updatedDream
			};
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
