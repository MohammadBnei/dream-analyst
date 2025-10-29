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
    let accumulatedInterpretation = ''; // To save partial results
    let accumulatedTags: string[] = []; // To save partial results

    n8nStream.pipeTo(new WritableStream({
        async write(chunk) {
            try {
                jsonBuffer += decoder.decode(chunk, { stream: true });

                let boundary = jsonBuffer.indexOf('\n');
                while (boundary !== -1) {
                    const line = jsonBuffer.substring(0, boundary).trim();
                    jsonBuffer = jsonBuffer.substring(boundary + 1);

                    if (line) {
                        try {
                            const parsedChunk: AnalysisStreamChunk = JSON.parse(line);

                            // Accumulate interpretation and tags
                            if (parsedChunk.content) {
                                accumulatedInterpretation += parsedChunk.content;
                            }
                            if (parsedChunk.tags) {
                                accumulatedTags = parsedChunk.tags; // Assuming tags are sent as a complete array each time
                            }

                            // Check for final status signals from n8nService
                            if (parsedChunk.finalStatus && !dreamStatusUpdated) {
                                await prisma.dream.update({
                                    where: { id: dreamId },
                                    data: {
                                        status: parsedChunk.finalStatus,
                                        interpretation: accumulatedInterpretation,
                                        tags: accumulatedTags
                                    }
                                }).catch(updateError => console.error(`Failed to update dream status to ${parsedChunk.finalStatus} for ${dreamId} during stream write:`, updateError));
                                dreamStatusUpdated = true;
                                console.log(`Dream ${dreamId}: Status updated to ${parsedChunk.finalStatus}`);
                                // Do not forward finalStatus to client, it's an internal signal
                                delete parsedChunk.finalStatus;
                            } else if (parsedChunk.status === 'analysis_failed' && !dreamStatusUpdated) {
                                await prisma.dream.update({
                                    where: { id: dreamId },
                                    data: {
                                        status: 'analysis_failed',
                                        interpretation: accumulatedInterpretation,
                                        tags: accumulatedTags
                                    }
                                }).catch(updateError => console.error(`Failed to update dream status to analysis_failed for ${dreamId} during stream write:`, updateError));
                                dreamStatusUpdated = true;
                                console.log(`Dream ${dreamId}: Status updated to analysis_failed (from chunk status)`);
                            }

                            // Forward the chunk to the client
                            if (Object.keys(parsedChunk).length > 0) {
                                try {
                                    await writer.write(encoder.encode(JSON.stringify(parsedChunk) + '\n'));
                                } catch (writeError) {
                                    console.warn(`Dream ${dreamId}: Failed to write chunk to client (client likely disconnected):`, writeError);
                                    // If client disconnected, we should abort the stream
                                    this.abort(writeError); // Propagate the error to the abort handler
                                    return; // Stop further processing in this write call
                                }
                            }

                        } catch (e) {
                            console.warn(`Dream ${dreamId}: Failed to parse stream line from n8nService or process chunk: ${line}`, e);
                            try {
                                await writer.write(encoder.encode(JSON.stringify({ message: `Error processing stream data: ${line}` }) + '\n'));
                            } catch (writeError) {
                                console.warn(`Dream ${dreamId}: Failed to write error message to client (client likely disconnected):`, writeError);
                                this.abort(writeError);
                                return;
                            }
                        }
                    }
                    boundary = jsonBuffer.indexOf('\n');
                }
            } catch (e) {
                console.error(`Dream ${dreamId}: Unhandled error in WritableStream write method:`, e);
                // Attempt to signal an error to the client and update dream status if not already done
                if (!dreamStatusUpdated) {
                    await prisma.dream.update({
                        where: { id: dreamId },
                        data: {
                            status: 'analysis_failed',
                            interpretation: accumulatedInterpretation,
                            tags: accumulatedTags
                        }
                    }).catch(updateError => console.error(`Failed to update dream status to analysis_failed for ${dreamId} during unhandled write error:`, updateError));
                    dreamStatusUpdated = true;
                }
                try {
                    await writer.write(encoder.encode(JSON.stringify({ message: `Internal server error during stream processing: ${(e instanceof Error ? e.message : String(e))}`, status: 'analysis_failed' }) + '\n'));
                } catch (writeError) {
                    console.warn(`Dream ${dreamId}: Failed to write internal error message to client:`, writeError);
                }
                writer.close(); // Close the stream to prevent further issues
            }
        },
        async close() {
            try {
                // Process any remaining content in the buffer
                if (jsonBuffer.trim()) {
                    try {
                        const parsedChunk: AnalysisStreamChunk = JSON.parse(jsonBuffer.trim());
                        if (parsedChunk.finalStatus && !dreamStatusUpdated) {
                            await prisma.dream.update({
                                where: { id: dreamId },
                                data: {
                                    status: parsedChunk.finalStatus,
                                    interpretation: accumulatedInterpretation,
                                    tags: accumulatedTags
                                }
                            }).catch(updateError => console.error(`Failed to update dream status to ${parsedChunk.finalStatus} for ${dreamId} during stream close:`, updateError));
                            dreamStatusUpdated = true;
                            console.log(`Dream ${dreamId}: Status updated to ${parsedChunk.finalStatus} (from final buffer)`);
                            delete parsedChunk.finalStatus;
                        } else if (parsedChunk.status === 'analysis_failed' && !dreamStatusUpdated) {
                            await prisma.dream.update({
                                where: { id: dreamId },
                                data: {
                                    status: 'analysis_failed',
                                    interpretation: accumulatedInterpretation,
                                    tags: accumulatedTags
                                }
                            }).catch(updateError => console.error(`Failed to update dream status to analysis_failed for ${dreamId} during stream close:`, updateError));
                            dreamStatusUpdated = true;
                            console.log(`Dream ${dreamId}: Status updated to analysis_failed (from final buffer chunk status)`);
                        }
                        if (Object.keys(parsedChunk).length > 0) {
                            try {
                                await writer.write(encoder.encode(JSON.stringify(parsedChunk) + '\n'));
                            } catch (writeError) {
                                console.warn(`Dream ${dreamId}: Failed to write final chunk to client (client likely disconnected):`, writeError);
                            }
                        }
                    } catch (e) {
                        console.warn(`Dream ${dreamId}: Failed to parse final stream buffer from n8nService as JSON: ${jsonBuffer.trim()}`, e);
                        if (!writer.closed) {
                            try {
                                await writer.write(encoder.encode(JSON.stringify({ message: `Error processing final stream data: ${jsonBuffer.trim()}` }) + '\n'));
                            } catch (writeError) {
                                console.warn(`Dream ${dreamId}: Failed to write final error message to client:`, writeError);
                            }
                        }
                    }
                }

                // If the stream closed without an explicit finalStatus and no error was reported, assume completion
                if (!dreamStatusUpdated) {
                    await prisma.dream.update({
                        where: { id: dreamId },
                        data: {
                            status: 'completed',
                            interpretation: accumulatedInterpretation,
                            tags: accumulatedTags
                        }
                    }).catch(updateError => console.error(`Failed to update dream status to completed for ${dreamId} during stream close:`, updateError));
                    console.log(`Dream ${dreamId}: Status updated to completed (stream closed without explicit finalStatus)`);
                }
                console.log(`Dream ${dreamId}: Orchestration stream finished.`);
                await writer.close();
            } catch (e) {
                console.error(`Dream ${dreamId}: Unhandled error in WritableStream close method:`, e);
                // Attempt to update dream status if not already done
                if (!dreamStatusUpdated) {
                    await prisma.dream.update({
                        where: { id: dreamId },
                        data: {
                            status: 'analysis_failed',
                            interpretation: accumulatedInterpretation,
                            tags: accumulatedTags
                        }
                    }).catch(updateError => console.error(`Failed to update dream status to analysis_failed for ${dreamId} during unhandled close error:`, updateError));
                    dreamStatusUpdated = true;
                }
                // Ensure writer is closed even if an error occurs during close
                writer.close();
            }
        },
        async abort(reason) {
            const errorMessage = reason instanceof Error ? reason.message : String(reason || 'Unknown error');
            console.error(`Dream ${dreamId}: Orchestration stream aborted:`, errorMessage);

            // Always attempt to update the dream status on abort, saving partial results
            if (!dreamStatusUpdated) {
                await prisma.dream.update({
                    where: { id: dreamId },
                    data: {
                        status: 'analysis_failed', // Mark as failed because it was interrupted
                        interpretation: accumulatedInterpretation,
                        tags: accumulatedTags
                    }
                }).catch(updateError => console.error(`Failed to update dream status to analysis_failed for ${dreamId} during stream abort:`, updateError));
                dreamStatusUpdated = true;
                console.log(`Dream ${dreamId}: Status updated to analysis_failed (orchestration stream aborted)`);
            }

            // Attempt to write an error message before closing, but don't let it block if client is already gone
            try {
                await writer.write(encoder.encode(JSON.stringify({ message: `Analysis stream aborted: ${errorMessage}`, status: 'analysis_failed' }) + '\n'));
            } catch (writeError) {
                console.warn(`Dream ${dreamId}: Failed to write abort message to client (client likely disconnected):`, writeError);
            }
            await writer.close();
        }
    }));

    // Return the readable side of the TransformStream as a Response
    return new Response(readable, {
        headers: {
            'Content-Type': 'application/x-ndjson', // Newline Delimited JSON
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
