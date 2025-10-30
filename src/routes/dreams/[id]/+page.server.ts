import { fail, redirect } from '@sveltejs/kit';
import { getPrismaClient } from '$lib/server/db';
import * as v from 'valibot';
import type { PageServerLoad, Actions } from './$types';
import { error } from '@sveltejs/kit';
import { getAnalysisStore } from '$lib/server/analysisStore';
import { DreamStatus } from '@prisma/client'; // Import the Prisma DreamStatus enum

// Schemas for validation
const UpdateDreamSchema = v.object({
    rawText: v.pipe(v.string(), v.minLength(10, 'Dream text must be at least 10 characters long.'))
});

const UpdateInterpretationSchema = v.object({
    interpretation: v.pipe(v.string(), v.minLength(10, 'Interpretation must be at least 10 characters long.'))
});

const UpdateStatusSchema = v.object({
    status: v.picklist([DreamStatus.PENDING_ANALYSIS, DreamStatus.COMPLETED, DreamStatus.ANALYSIS_FAILED])
});

export const load: PageServerLoad = async ({ params, locals }) => {
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
            }
        });

        if (!dream) {
            throw error(404, 'Dream not found.');
        }

        // Ensure tags are parsed correctly if stored as JSON string
        const dreamWithParsedTags = {
            ...dream,
            tags: dream.tags ? (dream.tags as string[]) : null
        };

        return {
            dream: dreamWithParsedTags
        };
    } catch (e: any) {
        console.error(`Error fetching dream ${dreamId}:`, e);
        if (e.status) { // Re-throw SvelteKit errors
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
            return fail(500, { interpretation, error: 'Failed to update dream interpretation due to a server error.' });
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
            if (e.status === 303) { // Re-throw redirect
                throw e;
            }
            return fail(500, { error: 'Failed to delete dream.' });
        }
    },

    resetAnalysis: async ({ params, locals }) => {
        const dreamId = params.id;
        const sessionUser = locals.user;
        if (!sessionUser) {
            return fail(401, { message: 'Unauthorized' });
        }

        const prisma = await getPrismaClient();

        const dream = await prisma.dream.findUnique({
            where: { id: dreamId }
        });

        if (!dream || dream.userId !== sessionUser.id) {
            return fail(403, { error: 'Forbidden: Dream does not belong to user or does not exist.' });
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
            return { success: true, message: 'Dream status reset to PENDING_ANALYSIS.' };
        } catch (e) {
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
    },

    // Changed to DELETE method for cancellation
    cancelAnalysis: async ({ params, locals }) => {
        const dreamId = params.id;
        const sessionUser = locals.user;
        if (!sessionUser) {
            return fail(401, { message: 'Unauthorized' });
        }

        const prisma = await getPrismaClient();
        const analysisStore = await getAnalysisStore();

        try {
            const dream = await prisma.dream.findUnique({
                where: { id: dreamId }
            });

            if (!dream || dream.userId !== sessionUser.id) {
                return fail(403, { error: 'Forbidden: Dream does not belong to user or does not exist.' });
            }

            // Publish cancellation message to Redis FIRST
            await analysisStore.publishUpdate(dreamId, { finalStatus: DreamStatus.ANALYSIS_FAILED, message: 'Analysis cancelled by user.' });

            // Then update dream status in DB
            await prisma.dream.update({
                where: { id: dreamId },
                data: { status: DreamStatus.ANALYSIS_FAILED } // Use enum
            });

            // Clear Redis state
            await analysisStore.clearAnalysis(dreamId);

            return { success: true, message: 'Analysis cancelled successfully.' };
        } catch (e) {
            console.error(`Error cancelling analysis for dream ${dreamId}:`, e);
            return fail(500, { error: 'Failed to cancel analysis.' });
        }
    }
};
