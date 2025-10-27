import { env } from '$env/dynamic/private';

const N8N_WEBHOOK_URL = env.N8N_WEBHOOK_URL || 'https://your-n8n-instance.com/webhook/dream-analysis';

interface AnalysisResult {
  tags: string[];
  interpretation: string;
}

export async function triggerDreamAnalysis(dreamId: string, rawText: string): Promise<AnalysisResult> {
  if (!N8N_WEBHOOK_URL || N8N_WEBHOOK_URL === 'https://your-n8n-instance.com/webhook/dream-analysis') {
    console.warn('N8N_WEBHOOK_URL is not configured. Skipping n8n call.');
    // Return a mock analysis result for development if n8n is not configured
    return {
      tags: ['mock', 'analysis'],
      interpretation: 'This is a mock interpretation because n8n webhook URL is not set.'
    };
  }

  try {
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dreamId, rawText }),
    });

    if (!n8nResponse.ok) {
      const errorBody = await n8nResponse.text();
      console.error(`n8n webhook failed for dream ${dreamId}: ${n8nResponse.status} - ${errorBody}`);
      throw new Error(`Failed to get analysis from n8n: ${n8nResponse.status} - ${errorBody}`);
    }

    const analysisData = await n8nResponse.json();

    if (!Array.isArray(analysisData.tags) || typeof analysisData.interpretation !== 'string') {
      console.error('Invalid analysis data from n8n:', analysisData);
      throw new Error('Invalid analysis response format from n8n.');
    }

    return analysisData as AnalysisResult;

  } catch (error) {
    console.error('Error calling n8n webhook:', error);
    throw new Error(`Failed to trigger dream analysis: ${(error as Error).message}`);
  }
}
