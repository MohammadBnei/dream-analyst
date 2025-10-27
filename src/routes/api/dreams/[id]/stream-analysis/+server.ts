// src/routes/api/dreams/[id]/stream-analysis/+server.ts
import { error } from '@sveltejs/kit';
import { initiateStreamedDreamAnalysis } from '$lib/server/n8nService';
import prisma from '$lib/server/db';

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
    if (dream.status !== 'pending_analysis') {
        // If analysis is already completed or failed, we might want to just return the stored data
        // or throw an error depending on desired behavior. For now, let's error.
        throw error(409, 'Analysis for this dream is not pending.');
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
        throw error(500, `Failed to start dream analysis: ${(e as Error).message}`);
    }

    // Create a TransformStream to process n8n's stream and forward as SSE
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    let fullInterpretation = '';
    let finalTags: string[] = [];
    let n8nStreamErrored = false;
    let jsonBuffer = ''; // Buffer to accumulate potentially fragmented JSON

    // Read from n8n's response stream
    n8nResponse.body?.pipeTo(new WritableStream({
        async write(chunk) {
            jsonBuffer += decoder.decode(chunk, { stream: true });

            let boundary = jsonBuffer.indexOf('\n');
            while (boundary !== -1) {
                const line = jsonBuffer.substring(0, boundary).trim();
                jsonBuffer = jsonBuffer.substring(boundary + 1);

                if (line) {
                    try {
                        const data = JSON.parse(line);
                        if (data.interpretation) {
                            fullInterpretation += data.interpretation;
                        }
                        if (data.tags) {
                            finalTags = data.tags;
                        }
                        // Forward the chunk as an SSE message
                        await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                    } catch (e) {
                        console.warn('Could not parse stream chunk as JSON:', line, e);
                        // If it's not JSON, just forward it as a raw message or ignore
                        // For robust SSE, each message should be `data: {json_payload}\n\n`
                        // We'll still forward it as data, but it might not be JSON on the client side
                        await writer.write(encoder.encode(`data: ${line}\n\n`));
                    }
                }
                boundary = jsonBuffer.indexOf('\n');
            }
        },
        async close() {
            console.log(`n8n stream for dream ${dreamId} finished.`);

            // Process any remaining content in the buffer
            if (jsonBuffer.trim()) {
                try {
                    const data = JSON.parse(jsonBuffer.trim());
                    if (data.interpretation) {
                        fullInterpretation += data.interpretation;
                    }
                    if (data.tags) {
                        finalTags = data.tags;
                    }
                    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                } catch (e) {
                    console.warn('Could not parse final buffer chunk as JSON:', jsonBuffer.trim(), e);
                    await writer.write(encoder.encode(`data: ${jsonBuffer.trim()}\n\n`));
                }
            }

            // Send a final 'end' event to the client
            await writer.write(encoder.encode('event: end\ndata: {"status": "completed"}\n\n'));
            await writer.close();

            // Update the dream in the database with the full results
            if (!n8nStreamErrored) {
                try {
                    await prisma.dream.update({
                        where: { id: dreamId },
                        data: {
                            interpretation: fullInterpretation,
                            tags: finalTags,
                            status: 'completed'
                        }
                    });
                    console.log(`Dream ${dreamId} updated with analysis results.`);
                } catch (dbError) {
                    console.error(`Failed to update dream ${dreamId} in DB after analysis:`, dbError);
                    await prisma.dream.update({
                        where: { id: dreamId },
                        data: { status: 'analysis_failed' }
                    }).catch(e => console.error(`Failed to set dream ${dreamId} status to analysis_failed:`, e));
                }
            }
        },
        async abort(reason) {
            console.error(`n8n stream for dream ${dreamId} aborted:`, reason);
            n8nStreamErrored = true;
            const errorMessage = reason instanceof Error ? reason.message : String(reason);
            await writer.write(encoder.encode(`event: error\ndata: {"message": "Analysis stream aborted: ${errorMessage}"}\n\n`));
            await writer.close();
            // Update dream status to analysis_failed
            await prisma.dream.update({
                where: { id: dreamId },
                data: { status: 'analysis_failed' }
            }).catch(e => console.error(`Failed to set dream ${dreamId} status to analysis_failed after abort:`, e));
        }
    })).catch(async (e) => {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error(`Error piping n8n response body for dream ${dreamId}:`, errorMessage);
        n8nStreamErrored = true;
        await writer.write(encoder.encode(`event: error\ndata: {"message": "Internal server error during stream processing: ${errorMessage}"}\n\n`));
        await writer.close();
        // Update dream status to analysis_failed
        await prisma.dream.update({
            where: { id: dreamId },
            data: { status: 'analysis_failed' }
        }).catch(updateError => console.error(`Failed to set dream ${dreamId} status to analysis_failed after pipe error:`, updateError));
    });

    return new Response(readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
