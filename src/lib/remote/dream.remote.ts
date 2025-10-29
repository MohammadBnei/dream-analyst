import { query, command, getRequestEvent } from '$app/server';
import prisma from '$lib/server/db';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';

// Helper to get the current user from the request event
async function getCurrentUser() {
    const event = getRequestEvent();
    if (!event?.locals.user) {
        error(401, 'Unauthorized');
    }
    return event.locals.user;
}

// --- Queries ---

// Get all dreams for the current user
export const getDreams = query(async () => {
    const sessionUser = await getCurrentUser();

    const dreams = await prisma.dream.findMany({
        where: {
            userId: sessionUser.id
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    // Ensure tags are parsed correctly if stored as JSON string
    const dreamsWithParsedTags = dreams.map(dream => ({
        ...dream,
        tags: dream.tags ? (dream.tags as string[]) : null
    }));

    return dreamsWithParsedTags;
});

// Get a single dream by ID for the current user
export const getDream = query(
    v.string(),
    async (dreamId) => {
        const sessionUser = await getCurrentUser();

        const dream = await prisma.dream.findUnique({
            where: {
                id: dreamId,
                userId: sessionUser.id
            }
        });

        if (!dream) {
            error(404, 'Dream not found.');
        }

        // Ensure tags are parsed correctly if stored as JSON string
        const dreamWithParsedTags = {
            ...dream,
            tags: dream.tags ? (dream.tags as string[]) : null
        };

        return dreamWithParsedTags;
    }
);

// --- Commands ---

// Create a new dream
export const createDream = command(
    v.object({
        rawText: v.pipe(v.string(), v.minLength(10, 'Dream text must be at least 10 characters long.'))
    }),
    async ({ rawText }) => {
        const sessionUser = await getCurrentUser();

        try {
            const newDream = await prisma.dream.create({
                data: {
                    userId: sessionUser.id,
                    rawText: rawText,
                    status: 'pending_analysis'
                }
            });

            return { dreamId: newDream.id, message: 'Dream saved. Initiating analysis stream...' };
        } catch (e) {
            console.error('Error saving dream:', e);
            error(500, 'Failed to save dream. Please try again.');
        }
    }
);

// Delete a dream
export const deleteDream = command(
    v.string(), // dreamId
    async (dreamId) => {
        const sessionUser = await getCurrentUser();

        try {
            const dream = await prisma.dream.findUnique({
                where: {
                    id: dreamId,
                    userId: sessionUser.id
                }
            });

            if (!dream) {
                error(404, 'Dream not found or you do not have permission to delete it.');
            }

            await prisma.dream.delete({
                where: {
                    id: dreamId
                }
            });

            return { message: 'Dream deleted successfully.' };
        } catch (e) {
            console.error('Error deleting dream:', e);
            error(500, 'Failed to delete dream.');
        }
    }
);

// Update dream status
export const updateDreamStatus = command(
    v.object({
        dreamId: v.string(),
        status: v.picklist(['pending_analysis', 'completed', 'analysis_failed'])
    }),
    async ({ dreamId, status }) => {
        const sessionUser = await getCurrentUser();

        try {
            const existingDream = await prisma.dream.findUnique({
                where: { id: dreamId }
            });

            if (!existingDream || existingDream.userId !== sessionUser.id) {
                error(403, 'Forbidden: You do not own this dream or it does not exist.');
            }

            const updatedDream = await prisma.dream.update({
                where: { id: dreamId },
                data: {
                    status: status as App.Dream['status'],
                    updatedAt: new Date()
                }
            });
            return { message: 'Dream status updated successfully', dream: updatedDream };
        } catch (e) {
            console.error('Error updating dream status:', e);
            error(500, 'Failed to update dream status due to a server error.');
        }
    }
);

// Reset dream status (for re-analysis)
export const resetDreamStatus = command(
    v.string(), // dreamId
    async (dreamId) => {
        const sessionUser = await getCurrentUser();

        const dream = await prisma.dream.findUnique({
            where: { id: dreamId }
        });

        if (!dream || dream.userId !== sessionUser.id) {
            error(403, 'Forbidden: Dream does not belong to user or does not exist.');
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
            return { message: 'Dream status reset to pending_analysis.' };
        } catch (e) {
            console.error(`Failed to reset dream status for ${dreamId}:`, e);
            error(500, 'Failed to reset dream status.');
        }
    }
);
