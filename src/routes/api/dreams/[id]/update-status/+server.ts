import { json, error } from '@sveltejs/kit';
import prisma from '$lib/server/db';

export async function POST({ request, params, locals }) {
    const dreamId = params.id;
    const sessionUser = locals.user;

    if (!sessionUser) {
        throw error(401, 'Unauthorized');
    }

    if (!dreamId) {
        throw error(400, 'Dream ID is required.');
    }

    const { status } = await request.json();

    if (!status || !['pending_analysis', 'completed', 'analysis_failed'].includes(status)) {
        throw error(400, 'Invalid status provided.');
    }

    try {
        // Verify the dream belongs to the authenticated user
        const existingDream = await prisma.dream.findUnique({
            where: { id: dreamId }
        });

        if (!existingDream || existingDream.userId !== sessionUser.id) {
            throw error(403, 'Forbidden: You do not own this dream or it does not exist.');
        }

        // Only allow changing from 'analysis_failed' to 'pending_analysis'
        if (existingDream.status === 'analysis_failed' && status === 'pending_analysis') {
            const updatedDream = await prisma.dream.update({
                where: { id: dreamId },
                data: {
                    status: status as App.Dream['status'],
                    updatedAt: new Date()
                }
            });
            return json({ message: 'Dream status updated successfully', dream: updatedDream });
        } else if (existingDream.status !== 'analysis_failed') {
            throw error(400, `Cannot change status from '${existingDream.status}' manually.`);
        } else {
            // This case handles if existingDream.status is 'analysis_failed' but new status is not 'pending_analysis'
            throw error(400, `Invalid status change from '${existingDream.status}' to '${status}'.`);
        }

    } catch (e) {
        console.error('Error updating dream status:', e);
        if (e instanceof Error && (e as any).status) { // Check if it's a thrown error from SvelteKit
            throw e;
        }
        throw error(500, 'Failed to update dream status due to a server error.');
    }
}
