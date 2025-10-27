import { fail, redirect } from '@sveltejs/kit';
import prisma from '$lib/server/db';
import { triggerDreamAnalysis } from '$lib/server/n8nService';

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

		try {
			// 1. Persist dream with pending status
			const newDream = await prisma.dream.create({
				data: {
					userId: sessionUser.id,
					rawText: rawText,
					status: 'pending_analysis'
				}
			});

			// 2. Trigger n8n analysis (asynchronously)
			// The n8n service will return a placeholder, and the actual results
			// will be updated via a separate callback to /api/dreams/:id/result
			triggerDreamAnalysis(newDream.id, rawText)
				.catch((error) => {
					console.error(`Failed to trigger n8n for dream ${newDream.id}:`, error);
					// Update dream status to analysis_failed if n8n trigger fails
					prisma.dream.update({
						where: { id: newDream.id },
						data: { status: 'analysis_failed' }
					}).catch(e => console.error(`Failed to update dream status to analysis_failed for ${newDream.id}:`, e));
				});

			// Return the newly created dream (with pending status) to the client
			// The client will then show a loading state until the analysis is complete
			return {
				status: 201,
				dream: {
					id: newDream.id,
					userId: newDream.userId,
					rawText: newDream.rawText,
					analysisText: newDream.analysisText,
					interpretation: newDream.interpretation,
					status: newDream.status,
					tags: newDream.tags ? (newDream.tags as string[]) : [], // Ensure tags are an array
					createdAt: newDream.createdAt,
					updatedAt: newDream.updatedAt
				},
				message: 'Dream saved and analysis initiated.'
			};
		} catch (error) {
			console.error('Error saving dream:', error);
			return fail(500, { message: 'Failed to save dream. Please try again.' });
		}
	}
};
