// src/routes/api/dreams/[id]/stream-analysis/+server.ts
import { error } from '@sveltejs/kit';
import { initiateStreamedDreamAnalysis, type AnalysisStreamChunk } from '$lib/server/n8nService';
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
        throw error(409, 'Analysis for this dream is not pending. Please reset its status if you wish to re-analyze.');
    }

    let n8nStream: ReadableStream<Uint8Array>;
    try {
        n8nStream = await initiateStreamedDreamAnalysis(dreamId, dream.rawText);
    } catch (e) {
        console.error(`Failed to initiate n8n stream for dream ${dreamId}:`, e);
        // If n8n initiation fails, update dream status to analysis_failed
        await prisma.dream.update({
            where: { id: dreamId },
            data: { status: 'analysis_failed' }
        }).catch(updateError => console.error(`Failed to update dream status to analysis_failed for ${dreamId}:`, updateError));
        throw error(500, `Failed to start dream analysis: ${(e instanceof Error ? e.message : String(e))}`);
    }

    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    let jsonBuffer = '';
    let dreamStatusUpdated = false; // Flag to ensure status is updated only once

    n8nStream.pipeTo(new WritableStream({
        async write(chunk) {
            jsonBuffer += decoder.decode(chunk, { stream: true });

            let boundary = jsonBuffer.indexOf('\n');
            while (boundary !== -1) {
                const line = jsonBuffer.substring(0, boundary).trim();
                jsonBuffer = jsonBuffer.substring(boundary + 1);

                if (line) {
                    try {
                        const parsedChunk: AnalysisStreamChunk = JSON.parse(line);

                        // Check for final status signals from n8nService
                        if (parsedChunk.finalStatus && !dreamStatusUpdated) {
                            await prisma.dream.update({
                                where: { id: dreamId },
                                data: { status: parsedChunk.finalStatus }
                            });
                            dreamStatusUpdated = true;
                            console.log(`Dream ${dreamId}: Status updated to ${parsedChunk.finalStatus}`);
                            // Do not forward finalStatus to client, it's an internal signal
                            delete parsedChunk.finalStatus;
                        } else if (parsedChunk.status === 'analysis_failed' && !dreamStatusUpdated) {
                            // This might be redundant if finalStatus is always sent, but good for robustness
                            await prisma.dream.update({
                                where: { id: dreamId },
                                data: { status: 'analysis_failed' }
                            });
                            dreamStatusUpdated = true;
                            console.log(`Dream ${dreamId}: Status updated to analysis_failed (from chunk status)`);
                        }

                        // Forward the chunk to the client
                        if (Object.keys(parsedChunk).length > 0) { // Only send if there's actual data
                            await writer.write(encoder.encode(JSON.stringify(parsedChunk) + '\n'));
                        }

                    } catch (e) {
                        console.warn(`Dream ${dreamId}: Failed to parse stream line from n8nService as JSON: ${line}`, e);
                        // Forward parsing error to client
                        await writer.write(encoder.encode(JSON.stringify({ message: `Error processing stream data: ${line}` }) + '\n'));
                    }
                }
                boundary = jsonBuffer.indexOf('\n');
            }
        },
        async close() {
            // Process any remaining content in the buffer
            if (jsonBuffer.trim()) {
                try {
                    const parsedChunk: AnalysisStreamChunk = JSON.parse(jsonBuffer.trim());
                    if (parsedChunk.finalStatus && !dreamStatusUpdated) {
                        await prisma.dream.update({
                            where: { id: dreamId },
                            data: { status: parsedChunk.finalStatus }
                        });
                        dreamStatusUpdated = true;
                        console.log(`Dream ${dreamId}: Status updated to ${parsedChunk.finalStatus} (from final buffer)`);
                        delete parsedChunk.finalStatus;
                    } else if (parsedChunk.status === 'analysis_failed' && !dreamStatusUpdated) {
                        await prisma.dream.update({
                            where: { id: dreamId },
                            data: { status: 'analysis_failed' }
                        });
                        dreamStatusUpdated = true;
                        console.log(`Dream ${dreamId}: Status updated to analysis_failed (from final buffer chunk status)`);
                    }
                    if (Object.keys(parsedChunk).length > 0) {
                        await writer.write(encoder.encode(JSON.stringify(parsedChunk) + '\n'));
                    }
                } catch (e) {
                    console.warn(`Dream ${dreamId}: Failed to parse final stream buffer from n8nService as JSON: ${jsonBuffer.trim()}`, e);
                    await writer.write(encoder.encode(JSON.stringify({ message: `Error processing final stream data: ${jsonBuffer.trim()}` }) + '\n'));
                }
            }

            // If the stream closed without an explicit finalStatus and no error was reported, assume completion
            if (!dreamStatusUpdated) {
                await prisma.dream.update({
                    where: { id: dreamId },
                    data: { status: 'completed' }
                });
                console.log(`Dream ${dreamId}: Status updated to completed (stream closed without explicit finalStatus)`);
            }
            console.log(`Dream ${dreamId}: Orchestration stream finished.`);
            await writer.close();
        },
        async abort(reason) {
            const errorMessage = reason instanceof Error ? reason.message : String(reason || 'Unknown error');
            console.error(`Dream ${dreamId}: Orchestration stream aborted:`, errorMessage);
            if (!dreamStatusUpdated) {
                await prisma.dream.update({
                    where: { id: dreamId },
                    data: { status: 'analysis_failed' }
                });
                dreamStatusUpdated = true;
                console.log(`Dream ${dreamId}: Status updated to analysis_failed (orchestration stream aborted)`);
            }
            await writer.write(encoder.encode(JSON.stringify({ message: `Analysis stream aborted: ${errorMessage}`, status: 'analysis_failed' }) + '\n'));
            await writer.close();
        }
    }));

    return readable;
}
