import { error, json } from '@sveltejs/kit';
import { getStreamStateStore } from '$lib/server/streamStateStore'; // Updated import
import { getPrismaClient } from '$lib/server/db';
import { DreamStatus } from '@prisma/client'; // Ensure DreamStatus is imported

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
    const streamStateStore = await getStreamStateStore(); // Updated function call

    try {
        const dream = await prisma.dream.findUnique({
            where: { id: dreamId }
        });

        if (!dream || dream.userId !== sessionUser.id) {
            throw error(403, 'Forbidden: Dream does not belong to user or does not exist.');
        }

        if (dream.status !== DreamStatus.PENDING_ANALYSIS) { // Use DreamStatus enum
            return json({ message: 'Analysis is not currently pending for this dream.' }, { status: 409 });
        }

        // Publish a cancellation signal. This method now also clears the Redis state.
        await streamStateStore.publishCancellation(dreamId);

        // Update the dream status in the database to reflect cancellation
        await prisma.dream.update({
            where: { id: dreamId },
            data: {
                status: DreamStatus.ANALYSIS_FAILED, // Set status to failed upon cancellation
                interpretation: dream.interpretation || '', // Keep existing interpretation if any
                tags: dream.tags || [], // Keep existing tags if any
                updatedAt: new Date()
            }
        });

        console.debug(`Dream ${dreamId}: Analysis cancelled by user ${sessionUser.id}.`);
        return json({ message: 'Analysis cancelled successfully.' }, { status: 200 });

    } catch (e) {
        console.error(`Error cancelling analysis for dream ${dreamId}:`, e);
        throw error(500, `Failed to cancel analysis: ${(e as Error).message}`);
    }
}
