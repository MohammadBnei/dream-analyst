// src/routes/api/dreams/[id]/cancel-analysis/+server.ts
import { error, json } from '@sveltejs/kit';
import { getAnalysisStore } from '$lib/server/analysisStore';
import { getPrismaClient } from '$lib/server/db';

export async function DELETE({ params, locals }) {
    const dreamId = params.id;
    const sessionUser = locals.user;

    if (!sessionUser) {
        throw error(401, 'Unauthorized');
    }

    if (!dreamId) {
        throw error(400, 'Dream ID is required.');
    }

    const prisma = await getPrismaClient();
    const analysisStore = await getAnalysisStore();

    try {
        const dream = await prisma.dream.findUnique({
            where: { id: dreamId }
        });

        if (!dream || dream.userId !== sessionUser.id) {
            throw error(403, 'Forbidden: Dream does not belong to user or does not exist.');
        }

        if (dream.status !== 'pending_analysis') {
            return json({ message: 'Analysis is not currently pending for this dream.' }, { status: 409 });
        }

        // Clear the analysis state from Redis and publish a cancellation message
        await analysisStore.clearAnalysis(dreamId);
        await analysisStore.publishUpdate(dreamId, { finalStatus: 'analysis_failed', message: 'Analysis cancelled by user.' });

        // Update the dream status in the database
        await prisma.dream.update({
            where: { id: dreamId },
            data: {
                status: 'analysis_failed',
                interpretation: dream.interpretation || '', // Keep existing interpretation if any
                tags: dream.tags || [], // Keep existing tags if any
                updatedAt: new Date()
            }
        });

        console.log(`Dream ${dreamId}: Analysis cancelled by user ${sessionUser.id}.`);
        return json({ message: 'Analysis cancelled successfully.' }, { status: 200 });

    } catch (e) {
        console.error(`Error cancelling analysis for dream ${dreamId}:`, e);
        throw error(500, `Failed to cancel analysis: ${e.message}`);
    }
}
