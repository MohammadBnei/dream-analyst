import { json, error } from '@sveltejs/kit';
import prisma from '$lib/server/db';

export async function POST({ params, locals }) {
    const dreamId = params.id;
    const sessionUser = locals.user;

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
                status: 'pending_analysis',
                interpretation: null, // Clear previous interpretation
                tags: null // Clear previous tags
            }
        });
        return json({ message: 'Dream status reset to pending_analysis.' });
    } catch (e) {
        console.error(`Failed to reset dream status for ${dreamId}:`, e);
        throw error(500, 'Failed to reset dream status.');
    }
}
