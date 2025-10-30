import { json, error } from '@sveltejs/kit';
import { getPrismaClient } from '$lib/server/db';
import { DreamStatus } from '@prisma/client'; // Import the Prisma DreamStatus enum

export async function POST({ params, locals }) {
	const dreamId = params.id;
	const sessionUser = locals.user;

	const prisma = await getPrismaClient();

	if (!sessionUser) {
		throw error(401, 'Unauthorized');
	}

	if (!dreamId) {
		throw error(400, 'Dream ID is required.');
	}

	// Verify the dream belongs to the user
	const dream = await prisma.dream.findUnique({
		where: { id: dreamId }
	});

	if (!dream || dream.userId !== sessionUser.id) {
		throw error(403, 'Forbidden: Dream does not belong to user or does not exist.');
	}

	try {
		await prisma.dream.update({
			where: { id: dreamId },
			data: {
				status: DreamStatus.PENDING_ANALYSIS, // Use enum
				interpretation: null, // Clear previous interpretation
				tags: null // Clear previous tags
			}
		});
		return json({ message: 'Dream status reset to PENDING_ANALYSIS.' });
	} catch (e) {
		console.error(`Failed to reset dream status for ${dreamId}:`, e);
		throw error(500, 'Failed to reset dream status.');
	}
}
