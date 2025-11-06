import { getPrismaClient } from '$lib/server/db/index.js';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { DreamStatus } from '@prisma/client'; // Import the Prisma DreamStatus enum

const DEFAULT_PAGE_SIZE = 10; // Define a default page size

export const load: PageServerLoad = async ({ locals, url }) => {
	const sessionUser = locals.user;

	if (!sessionUser) {
		throw redirect(302, '/login');
	}

	const prisma = await getPrismaClient();

	const searchQuery = url.searchParams.get('query') || '';
	const page = parseInt(url.searchParams.get('page') || '1');
	const pageSize = parseInt(url.searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE));
	const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'; // Default to 'desc'

	const skip = (page - 1) * pageSize;
	const take = pageSize;

	let whereClause: any = {
		userId: sessionUser.id
	};

	if (searchQuery) {
		const safeSearchQuery = searchQuery.trim().replaceAll(' ', '|');
		whereClause = {
			...whereClause,
			OR: [
				{
					rawText: {
						search: safeSearchQuery,
						mode: 'insensitive'
					}
				},
				{
					interpretation: {
						search: safeSearchQuery,
						mode: 'insensitive'
					}
				}
				// {
				// 	tags: {
				// 		has: safeSearchQuery // Search within tags array
				// 	}
				// }
			]
		};
	}

	const [dreams, totalDreams] = await prisma.$transaction([
		prisma.dream.findMany({
			where: whereClause,
			orderBy: {
				dreamDate: sortOrder
			},
			skip,
			take
		}),
		prisma.dream.count({
			where: whereClause
		})
	]);

	// Ensure tags are parsed correctly if stored as JSON string
	const dreamsWithParsedTags = dreams.map((dream) => ({
		...dream,
		tags: dream.tags ? (dream.tags as string[]) : null // Assuming tags are stored as JSON array of strings
	}));

	const totalPages = Math.ceil(totalDreams / pageSize);

	return {
		dreams: dreamsWithParsedTags,
		query: searchQuery,
		currentPage: page,
		pageSize: pageSize,
		totalPages: totalPages,
		totalDreams: totalDreams,
		sortOrder: sortOrder
	};
};

export const actions: Actions = {
	cancelAnalysis: async ({ request, locals }) => {
		const sessionUser = locals.user;
		if (!sessionUser) {
			return fail(401, { message: 'Unauthorized' });
		}

		const formData = await request.formData();
		const dreamId = formData.get('dreamId')?.toString();

		if (!dreamId) {
			return fail(400, { error: 'Dream ID is required.' });
		}

		const prisma = await getPrismaClient();

		try {
			const dream = await prisma.dream.findUnique({
				where: { id: dreamId }
			});

			if (!dream || dream.userId !== sessionUser.id) {
				return fail(403, { error: 'Forbidden: Dream does not belong to user or does not exist.' });
			}

			// Update dream status in DB
			await prisma.dream.update({
				where: { id: dreamId },
				data: { status: DreamStatus.ANALYSIS_FAILED } // Use enum
			});

			return { success: true, message: 'Analysis cancelled successfully.' };
		} catch (e) {
			console.error(`Error cancelling analysis for dream ${dreamId}:`, e);
			return fail(500, { error: 'Failed to cancel analysis.' });
		}
	}
};
