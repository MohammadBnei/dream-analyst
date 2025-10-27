// src/lib/server/utils/n8nStreamProcessor.ts
import prisma from '$lib/server/db';

interface N8nStreamChunk {
    content?: string;
    tags?: string[];
    status?: 'pending_analysis' | 'completed' | 'analysis_failed';
    message?: string; // For error messages or other info
}

/**
 * Processes the n8n response stream, transforms it into SSE format,
 * and updates the database with the analysis results.
 * @param dreamId The ID of the dream being analyzed.
 * @param n8nResponseStream The ReadableStream from the n8n webhook response.
 * @returns A ReadableStream suitable for SSE.
 */
export function createN8nStreamProcessor(dreamId: string, n8nResponseStream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    let fullInterpretation = '';
    let finalTags: string[] = [];
    let n8nStreamErrored = false;
    let jsonBuffer = ''; // Buffer to accumulate potentially fragmented JSON

    n8nResponseStream.pipeTo(new WritableStream({
        async write(chunk) {
            try {
                jsonBuffer += decoder.decode(chunk, { stream: true });

                let boundary = jsonBuffer.indexOf('\n');
                while (boundary !== -1) {
                    const line = jsonBuffer.substring(0, boundary).trim();
                    jsonBuffer = jsonBuffer.substring(boundary + 1);

                    if (line) {
                        try {
                            const data: N8nStreamChunk = JSON.parse(line);
                            if (data.content) {
                                fullInterpretation += data.content;
                            }
                            if (data.tags) {
                                finalTags = data.tags; // Assume tags are sent as a complete array, possibly multiple times
                            }
                            // Forward the chunk as an SSE message
                            await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                        } catch (e) {
                            const parseError = e instanceof Error ? e.message : String(e);
                            console.warn(`Dream ${dreamId}: Could not parse stream chunk as JSON:`, line, parseError);
                            // If it's not JSON, just forward it as a raw message or ignore
                            await writer.write(encoder.encode(`data: ${line}\n\n`));
                        }
                    }
                    boundary = jsonBuffer.indexOf('\n');
                }
            } catch (e) {
                const writeError = e instanceof Error ? e.message : String(e);
                console.error(`Dream ${dreamId}: Error during WritableStream write operation:`, writeError);
                n8nStreamErrored = true;
                // Propagate the error to abort the stream
                throw e;
            }
        },
        async close() {
            console.log(`Dream ${dreamId}: n8n stream finished.`);

            // Process any remaining content in the buffer
            if (jsonBuffer.trim()) {
                try {
                    const data: N8nStreamChunk = JSON.parse(jsonBuffer.trim());
                    if (data.content) {
                        fullInterpretation += data.content;
                    }
                    if (data.tags) {
                        finalTags = data.tags;
                    }
                    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                } catch (e) {
                    const parseError = e instanceof Error ? e.message : String(e);
                    console.warn(`Dream ${dreamId}: Could not parse final buffer chunk as JSON:`, jsonBuffer.trim(), parseError);
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
                            tags: finalTags, // Save final tags
                            status: 'completed'
                        }
                    });
                    console.log(`Dream ${dreamId} updated with analysis results.`);
                } catch (dbError) {
                    console.error(`Dream ${dreamId}: Failed to update dream in DB after analysis:`, dbError);
                    await prisma.dream.update({
                        where: { id: dreamId },
                        data: { status: 'analysis_failed' }
                    }).catch(e => console.error(`Dream ${dreamId}: Failed to set status to analysis_failed after DB update error:`, e));
                }
            }
        },
        async abort(reason) {
            const errorMessage = reason instanceof Error ? reason.message : String(reason || 'Unknown reason');
            console.error(`Dream ${dreamId}: n8n stream aborted:`, errorMessage);
            n8nStreamErrored = true;
            await writer.write(encoder.encode(`event: error\ndata: {"message": "Analysis stream aborted: ${errorMessage}"}\n\n`));
            await writer.close();
            // Update dream status to analysis_failed
            await prisma.dream.update({
                where: { id: dreamId },
                data: { status: 'analysis_failed' }
            }).catch(e => console.error(`Dream ${dreamId}: Failed to set status to analysis_failed after abort:`, e));
        }
    })).catch(async (e) => {
        const errorMessage = e instanceof Error ? e.message : String(e || 'Unknown error during pipeTo');
        console.error(`Dream ${dreamId}: Error piping n8n response body:`, errorMessage);
        n8nStreamErrored = true;
        await writer.write(encoder.encode(`event: error\ndata: {"message": "Internal server error during stream processing: ${errorMessage}"}\n\n`));
        await writer.close();
        // Update dream status to analysis_failed
        await prisma.dream.update({
            where: { id: dreamId },
            data: { status: 'analysis_failed' }
        }).catch(updateError => console.error(`Dream ${dreamId}: Failed to set status to analysis_failed after pipe error:`, updateError));
    });

    return readable;
}
