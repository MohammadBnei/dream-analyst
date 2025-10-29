import { env } from '$env/dynamic/private';

const N8N_WEBHOOK_URL = env.N8N_WEBHOOK_URL;

// This function will now initiate the request to n8n and return the Response object
// The caller (the new +server.ts endpoint) will then handle streaming this response to the client.
export async function initiateStreamedDreamAnalysis(dreamId: string, rawText: string): Promise<Response> {
  if (!N8N_WEBHOOK_URL) {
    throw new Error("N8N_WEBHOOK_URL is not defined");
  }

  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ dreamId, rawText })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`n8n webhook call failed for dream ${dreamId}: ${response.status} - ${errorText}`);
      throw new Error(`Failed to trigger n8n analysis: ${response.statusText}`);
    }

    // Assuming n8n returns a stream directly
    return response;

  } catch (error) {
    console.error('Error initiating n8n streamed dream analysis:', error);
    throw new Error(`Failed to initiate streamed dream analysis service: ${(error as Error).message}`);
  }
}
