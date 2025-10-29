import { env } from '$env/dynamic/private';

const N8N_WEBHOOK_URL = env.N8N_WEBHOOK_URL;

// Define the custom type for the processed stream chunks
export interface AnalysisStreamChunk {
  content?: string;
  tags?: string[];
  status?: 'pending_analysis' | 'completed' | 'analysis_failed';
  message?: string; // For error messages or other info
}

export async function initiateStreamedDreamAnalysis(dreamId: string, rawText: string): Promise<ReadableStream<Uint8Array>> {
  if (!N8N_WEBHOOK_URL) {
    throw new Error("N8N_WEBHOOK_URL is not defined");
  }
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ dreamId, rawText })
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      console.error(`n8n webhook call failed for dream ${dreamId}: ${response.status} - ${errorText}`);
      throw new Error(`Failed to trigger n8n analysis: ${response.statusText}`);
    }

    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();


    let jsonBuffer = ''; // Buffer to accumulate potentially fragmented JSON lines from n8n

    response.body.pipeTo(new WritableStream({
      async write(chunk) {
        jsonBuffer += decoder.decode(chunk, { stream: true });

        let boundary = jsonBuffer.indexOf('\n');
        while (boundary !== -1) {
          const line = jsonBuffer.substring(0, boundary).trim();
          jsonBuffer = jsonBuffer.substring(boundary + 1);

          if (line) {
            try {
              const n8nChunk = JSON.parse(line);
              const outputChunk: AnalysisStreamChunk = {};

              if (n8nChunk.type === 'item' && n8nChunk.content) {
                outputChunk.content = n8nChunk.content;
              }
              // Add logic here to handle other n8nChunk types if they contain status/tags
              // For example:
              // if (n8nChunk.type === 'end' && n8nChunk.tags) {
              //     outputChunk.tags = n8nChunk.tags;
              //     outputChunk.status = 'completed';
              // }

              if (Object.keys(outputChunk).length > 0) {
                await writer.write(encoder.encode(JSON.stringify(outputChunk) + '\n'));
              }
            } catch (e) {
              console.warn(`Dream ${dreamId}: Failed to parse n8n stream line as JSON: ${line}`, e);
              // Optionally, send an error message to the client
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
        await writer.close();
      },
      async abort(reason) {
        const errorMessage = reason instanceof Error ? reason.message : String(reason || 'Unknown error');
        console.error(`Dream ${dreamId}: n8n stream aborted:`, errorMessage);
        await writer.write(encoder.encode(JSON.stringify({ message: `Analysis stream aborted: ${errorMessage}`, status: 'analysis_failed' }) + '\n'));
        await writer.close();
      }
    }));

    return readable;

  } catch (error) {
    console.error('Error initiating n8n streamed dream analysis:', error);
    // Create a readable stream that immediately errors out
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(JSON.stringify({ message: `Failed to initiate streamed dream analysis service: ${(error as Error).message}`, status: 'analysis_failed' }) + '\n'));
        controller.close();
      }
    });
  }
}
