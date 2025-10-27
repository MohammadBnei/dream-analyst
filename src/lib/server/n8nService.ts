import { N8N_WEBHOOK_URL } from '$env/static/private';

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

    // The FDD implies an async callback for the actual results, so this return is a placeholder.
    // The actual results will be handled by the /api/dreams/:id/result endpoint.
    return {
      tags: [], // Empty tags as they will be updated via callback
      interpretation: 'Analysis initiated. Please refresh to see results.' // Placeholder
    };

  } catch (error) {
    console.error('Error triggering n8n dream analysis:', error);
    throw new Error(`Failed to trigger dream analysis service: ${(error as Error).message}`);
  }
}
