import { getPrismaClient } from '$lib/server/db';
import { json } from '@sveltejs/kit';

export async function POST({ request, params }) {
    const dreamId = params.id;
    const { tags, interpretation } = await request.json();

    if (!dreamId) {
        return json({ message: 'Dream ID is required.' }, { status: 400 });
    }
    if (!tags || !Array.isArray(tags) || !interpretation) {
        return json({ message: 'Tags (array) and interpretation (string) are required.' }, { status: 400 });
    }

    const prisma = await getPrismaClient();


    try {
        const updatedDream = await prisma.dream.update({
            where: { id: dreamId },
            data: {
                tags: tags, // Prisma handles JSONB directly with array of strings
                interpretation: interpretation,
                status: 'completed'
            }
        });

        return json({ message: 'Dream analysis results updated successfully.', dream: updatedDream }, { status: 200 });
    } catch (error) {
        console.error(`Error updating dream ${dreamId} with analysis results:`, error);
        // If update fails, set status to ANALYSIS_FAILED
        try {
            await prisma.dream.update({
                where: { id: dreamId },
                data: { status: 'ANALYSIS_FAILED' }
            });
        } catch (updateError) {
            console.error(`Failed to set dream ${dreamId} status to ANALYSIS_FAILED after initial error:`, updateError);
        }
        return json({ message: 'Failed to update dream analysis results.' }, { status: 500 });
    }
}
