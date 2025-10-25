import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { sql } from '$lib/server/db';

// This endpoint is designed to be called by n8n after it has processed a dream
// and received the analysis results (tags and interpretation) from the LLM.
export const POST: RequestHandler = async ({ request, params }) => {
  const dreamId = params.id;

  if (!dreamId) {
    return json({ error: 'Dream ID is required.' }, { status: 400 });
  }

  try {
    const { tags, interpretation } = await request.json();

    if (!tags || !Array.isArray(tags) || !interpretation) {
      return json({ error: 'Missing or invalid tags or interpretation in request body.' }, { status: 400 });
    }

    // Update the dream record with the analysis results and set status to 'completed'
    const [updatedDream] = await sql`
      UPDATE dreams
      SET
        tags = ${JSON.stringify(tags)}::jsonb,
        interpretation = ${interpretation},
        status = 'completed'
      WHERE id = ${dreamId}
      RETURNING id, status;
    `;

    if (!updatedDream) {
      return json({ error: 'Dream not found or not updated.' }, { status: 404 });
    }

    return json({ message: `Dream ${dreamId} analysis results saved successfully.`, dream: updatedDream });

  } catch (error) {
    console.error(`Error updating dream ${dreamId} with analysis results:`, error);
    return json({ error: 'Failed to save analysis results.' }, { status: 500 });
  }
};
