import { fail, redirect } from '@sveltejs/kit';
import { getPrismaClient } from '$lib/server/db';// Removed import for triggerDreamAnalysis as it's no longer called directly here

export const actions = {
	default: async ({ request, locals }) => {
		const sessionUser = locals.user;
		if (!sessionUser) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const rawText = data.get('dreamText')?.toString();

		if (!rawText || rawText.length < 10) {
			return fail(400, { message: 'Dream text must be at least 10 characters long.' });
		}

    const prisma = await getPrismaClient();

		try {
			// 1. Persist dream with pending status
			const newDream = await prisma.dream.create({
				data: {
					userId: sessionUser.id,
					rawText: rawText,
					status: 'pending_analysis'
				}
			});

			// Return the newly created dream ID to the client.
			// The client will then initiate the streaming analysis.
			return {
				status: 201,
				dreamId: newDream.id, // Only return the ID
				message: 'Dream saved. Initiating analysis stream...'
			};
		} catch (error) {
			console.error('Error saving dream:', error);
			return fail(500, { message: 'Failed to save dream. Please try again.' });
		}
	}
};
