// src/routes/api/dreams/[id]/stream-analysis/+server.ts
import { error } from '@sveltejs/kit';
import { initiateStreamedDreamAnalysis } from '$lib/server/n8nService';
import prisma from '$lib/server/db';
import { createN8nStreamProcessor } from '$lib/server/utils/n8nStreamProcessor';

export async function GET({ params, locals }) {
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

    // Ensure the dream is in a pending state for analysis
    // If analysis is already completed or failed, we might want to just return the stored data
    // or throw an error depending on desired behavior. For now, let's error.
    // The client can call /reset-status if they want to re-analyze.
    if (dream.status !== 'pending_analysis') {
        throw error(409, 'Analysis for this dream is not pending. Please reset its status if you wish to re-analyze.');
    }

    let n8nResponse: Response;
    try {
        n8nResponse = await initiateStreamedDreamAnalysis(dreamId, dream.rawText);
    } catch (e) {
        console.error(`Failed to initiate n8n stream for dream ${dreamId}:`, e);
        // Update dream status to analysis_failed if n8n initiation fails
        await prisma.dream.update({
            where: { id: dreamId },
            data: { status: 'analysis_failed' }
        }).catch(updateError => console.error(`Failed to update dream status to analysis_failed for ${dreamId}:`, updateError));
        throw error(500, `Failed to start dream analysis: ${(e instanceof Error ? e.message : String(e))}`);
    }

    if (!n8nResponse.body) {
        console.error(`n8n response body is null for dream ${dreamId}`);
        await prisma.dream.update({
            where: { id: dreamId },
            data: { status: 'analysis_failed' }
        }).catch(updateError => console.error(`Failed to update dream status to analysis_failed for ${dreamId}:`, updateError));
        throw error(500, 'n8n service returned an empty response body.');
    }

    // Use the new stream processor utility
    const sseStream = createN8nStreamProcessor(dreamId, n8nResponse.body);

    return new Response(sseStream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
