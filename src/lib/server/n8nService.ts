import { env } from '$env/dynamic/private';
import type { Dream } from '@prisma/client';

const N8N_WEBHOOK_URL = env.N8N_WEBHOOK_URL;
const N8N_AUDIO_TRANSCRIBE_URL = env.N8N_AUDIO_TRANSCRIBE_URL; // New environment variable for audio transcription
const N8N_AUTH = env.N8N_AUTH;

// Define the custom type for the processed stream chunks
// Renamed to N8nStreamChunk to reflect its origin, as it's not fully generic yet
export interface AnalysisStreamChunk { // Keeping this name for now to avoid cascading changes, but it's effectively N8nStreamChunk
    content?: string;
    tags?: string[];
    status?: Dream['status']; // This is still specific to DreamStatus
    message?: string; // For error messages or other info
    finalStatus?: 'COMPLETED' | 'ANALYSIS_FAILED'; // New field to signal final status
}

export async function initiateStreamedDreamAnalysis(dreamId: string, rawText: string): Promise<ReadableStream<Uint8Array>> {
    if (!N8N_WEBHOOK_URL) {
        throw new Error("N8N_WEBHOOK_URL is not defined");
    }

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'N8N_AUTH': N8N_AUTH
    };

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    try {
        const response = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ dreamId, rawText })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`n8n webhook call failed for dream ${dreamId}: ${response.status} - ${errorText}`);
            throw new Error(`Failed to trigger n8n analysis: ${response.statusText} - ${errorText}`);
        }

        if (!response.body) {
            console.error(`Dream ${dreamId}: n8n webhook response body is null.`);
            throw new Error(`n8n webhook did not return a readable body.`);
        }

        // Ensure response.body is a ReadableStream before piping
        if (!(response.body instanceof ReadableStream)) {
            const fullResponseText = await response.text(); // Read the body as text for debugging
            console.error(`Dream ${dreamId}: n8n webhook response body is not a ReadableStream. Actual type: ${typeof response.body}. Content: ${fullResponseText}`);
            throw new Error(`n8n webhook did not return a streaming response. Received: ${fullResponseText.substring(0, 200)}...`);
        }

        const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
        const writer = writable.getWriter();

        let jsonBuffer = '';

        response.body.pipeTo(new WritableStream({
            async write(chunk) {
                console.log(`Dream ${dreamId}: Received chunk from n8nResponseStream. Size: ${chunk.length}`);
                jsonBuffer += decoder.decode(chunk, { stream: true });

                let boundary = jsonBuffer.indexOf('\n');
                while (boundary !== -1) {
                    const line = jsonBuffer.substring(0, boundary).trim();
                    jsonBuffer = jsonBuffer.substring(boundary + 1);

                    if (line) {
                        try {
                            const n8nChunk = JSON.parse(line);
                            const outputChunk: AnalysisStreamChunk = {};

                            // Only extract content from 'item' type chunks
                            if (n8nChunk.type === 'item' && n8nChunk.content) {
                                outputChunk.content = n8nChunk.content;
                            }
                            // If n8n sends tags or status in specific chunks, handle them here
                            // Example: if (n8nChunk.type === 'tags' && n8nChunk.data) { outputChunk.tags = n8nChunk.data; }
                            // Example: if (n8nChunk.type === 'status' && n8nChunk.value) { outputChunk.status = n8nChunk.value; }

                            if (Object.keys(outputChunk).length > 0) {
                                await writer.write(encoder.encode(JSON.stringify(outputChunk) + '\n'));
                            }
                        } catch (e) {
                            console.warn(`Dream ${dreamId}: Failed to parse n8n stream line as JSON: ${line}`, e);
                            // If it's not JSON, we might still want to return it as a plain message
                            await writer.write(encoder.encode(JSON.stringify({ message: `Error parsing n8n data: ${line}` }) + '\n'));
                        }
                    }
                    boundary = jsonBuffer.indexOf('\n');
                }
            },
            async close() {
                // Process any remaining content in the buffer
                if (jsonBuffer.trim()) {
                    try {
                        const n8nChunk = JSON.parse(jsonBuffer.trim());
                        const outputChunk: AnalysisStreamChunk = {};
                        if (n8nChunk.type === 'item' && n8nChunk.content) {
                            outputChunk.content = n8nChunk.content;
                        }
                        if (Object.keys(outputChunk).length > 0) {
                            await writer.write(encoder.encode(JSON.stringify(outputChunk) + '\n'));
                        }
                    } catch (e) {
                        console.warn(`Dream ${dreamId}: Failed to parse final n8n stream buffer as JSON: ${jsonBuffer.trim()}`, e);
                        await writer.write(encoder.encode(JSON.stringify({ message: `Error parsing final n8n data: ${jsonBuffer.trim()}` }) + '\n'));
                    }
                }
                console.log(`Dream ${dreamId}: n8n stream finished.`);
                // Signal completion to the consumer
                await writer.write(encoder.encode(JSON.stringify({ finalStatus: 'COMPLETED' }) + '\n')); // Changed to DreamStatus.COMPLETED
                await writer.close();
            },
            async abort(reason) {
                const errorMessage = reason instanceof Error ? reason.message : String(reason || 'Unknown error');
                console.error(`Dream ${dreamId}: n8n stream aborted:`, errorMessage);
                // Signal failure to the consumer
                await writer.write(encoder.encode(JSON.stringify({ message: `Analysis stream aborted: ${errorMessage}`, finalStatus: 'ANALYSIS_FAILED' }) + '\n'));
                await writer.close();
            }
        }));

        return readable;

    } catch (error) {
        console.error('Error initiating n8n streamed dream analysis:', error);
        // Create a readable stream that immediately errors out
        return new ReadableStream({
            start(controller) {
                controller.enqueue(encoder.encode(JSON.stringify({ message: `Failed to initiate streamed dream analysis service: ${(error as Error).message}`, finalStatus: 'ANALYSIS_FAILED' }) + '\n'));
                controller.close();
            }
        });
    }
}

export async function initiateAudioTranscription(audioFile: Blob | File, lang: string = 'en'): Promise<{ transcription: string }> {
    if (!N8N_AUDIO_TRANSCRIBE_URL) {
        throw new Error("N8N_AUDIO_TRANSCRIBE_URL is not defined");
    }

    const formData = new FormData();
    // Changed 'file' to 'audio' to match the endpoint's expectation
    formData.append('audio', audioFile);

    const headers: HeadersInit = {};
    if (N8N_AUTH) {
        headers['N8N_AUTH'] = N8N_AUTH;
    }

    const url = new URL(N8N_AUDIO_TRANSCRIBE_URL);
    url.searchParams.append('lang', lang);

    try {
        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: headers, // FormData handles Content-Type: multipart/form-data automatically
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`n8n audio transcription call failed: ${response.status} - ${errorText}`);
            throw new Error(`Failed to transcribe audio: ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        if (typeof result.text !== 'string') {
            console.error('n8n audio transcription response did not contain a string "text":', result);
            throw new Error('Invalid response from audio transcription service.');
        }

        return { transcription: result.text };

    } catch (error) {
        console.error('Error initiating n8n audio transcription:', error);
        throw new Error(`Failed to initiate audio transcription service: ${(error as Error).message}`);
    }
}
