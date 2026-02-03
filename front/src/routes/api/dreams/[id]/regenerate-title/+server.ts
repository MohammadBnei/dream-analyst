import { json, error } from '@sveltejs/kit';
import { getPrismaClient } from '$lib/server/db';
import { getDreamAnalysisService } from '$lib/server/dreamAnalysisService';
import type { RequestHandler } from './$types';

function getCurrentUser(locals: App.Locals) {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}
	return locals.user;
}

export const POST: RequestHandler = async ({ params, locals }) => {
	const dreamId = params.id;
	const sessionUser = getCurrentUser(locals);

	if (!dreamId) {
		throw error(400, 'Dream ID is required.');
	}

	const prisma = await getPrismaClient();
	const dreamAnalysisService = getDreamAnalysisService();

	try {
		const dream = await prisma.dream.findUnique({
			where: { id: dreamId }
		});

		if (!dream || dream.userId !== sessionUser.id) {
			throw error(403, 'Forbidden: Dream does not belong to user or does not exist.');
		}

		if (!dream.rawText) {
			throw error(400, 'Dream has no raw text to generate a title from.');
		}

		const newTitle = await dreamAnalysisService.generateDreamTitle(dream.rawText);

		if (!newTitle) {
			throw error(500, 'Failed to generate dream title.');
		}

		const updatedDream = await prisma.dream.update({
			where: { id: dreamId },
			data: {
				title: newTitle,
				updatedAt: new Date()
			}
		});

		return json({ success: true, dream: updatedDream });
	} catch (e: any) {
		console.error('Error regenerating dream title:', e);
		if (e.status) {
			throw e; // Re-throw SvelteKit errors
		}
		throw error(500, 'Failed to regenerate dream title.');
	}
};
