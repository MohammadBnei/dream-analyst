import { json, error } from '@sveltejs/kit';
import { getPrismaClient } from '$lib/server/db';
import * as v from 'valibot'; // Import valibot for validation
import type { Dream } from '@prisma/client';

export async function POST({ request, params, locals }) {
    const dreamId = params.id;
    const sessionUser = locals.user;

    if (!sessionUser) {
        throw error(401, 'Unauthorized');
    }

    if (!dreamId) {
        throw error(400, 'Dream ID is required.');
    }

    const UpdateStatusSchema = v.object({
        status: v.picklist(['PENDING_ANALYSIS', 'completed', 'ANALYSIS_FAILED'])
    });

    let validatedData;
    try {
        const body = await request.json();
        validatedData = v.parse(UpdateStatusSchema, body);
    } catch (e) {
        console.error('Validation error:', e);
        throw error(400, 'Invalid request body.');
    }

    const prisma = await getPrismaClient();

    try {
        // Verify the dream belongs to the authenticated user
        const existingDream = await prisma.dream.findUnique({
            where: { id: dreamId }
        });

        if (!existingDream || existingDream.userId !== sessionUser.id) {
            throw error(403, 'Forbidden: You do not own this dream or it does not exist.');
        }

        const updatedDream = await prisma.dream.update({
            where: { id: dreamId },
            data: {
                status: validatedData.status as Dream['status'], // Use validated status
                updatedAt: new Date()
            }
        });
        return json({ message: 'Dream status updated successfully', dream: updatedDream });

    } catch (e) {
        console.error('Error updating dream status:', e);
        if (e instanceof Error && (e as any).status) { // Check if it's a thrown error from SvelteKit
            throw e;
        }
        throw error(500, 'Failed to update dream status due to a server error.');
    }
}
