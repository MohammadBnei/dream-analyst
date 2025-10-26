import type { PageServerLoad, Actions } from './$types';
import { sql } from '$lib/server/db';
import { error, redirect, fail } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

// Placeholder for n8n webhook URL
const N8N_WEBHOOK_URL = env.N8N_WEBHOOK_URL || 'https://your-n8n-instance.com/webhook/dream-analysis';

export const load: PageServerLoad = async ({ locals, params }) => {
  if (!locals.user) {
    throw redirect(302, '/login');
  }

  const userId = locals.user.id;
  const dreamId = params.id;

  try {
    const [dream] = await sql`
      SELECT id, created_at, raw_text, tags, interpretation, status
      FROM dreams
      WHERE id = ${dreamId} AND user_id = ${userId};
    `;

    if (!dream) {
      throw error(404, 'Dream not found or access denied.');
    }

    // Parse tags if stored as JSONB
    const parsedDream = {
      ...dream,
      tags: dream.tags ? JSON.parse(dream.tags) : [],
    };

    return {
      dream: parsedDream,
    };
  } catch (e) {
    console.error('Error loading dream:', e);
    throw error(500, 'Could not load dream details.');
  }
};

export const actions: Actions = {
  delete: async ({ locals, params }) => {
    if (!locals.user) {
      return fail(401, { error: 'Unauthorized' });
    }

    const userId = locals.user.id;
    const dreamId = params.id;

    try {
      const [deletedDream] = await sql`
        DELETE FROM dreams
        WHERE id = ${dreamId} AND user_id = ${userId}
        RETURNING id;
      `;

      if (!deletedDream) {
        return fail(404, { error: 'Dream not found or access denied.' });
      }

      // Redirect back to the dreams list after deletion
      throw redirect(303, '/dreams');
    } catch (e) {
      console.error('Error deleting dream:', e);
      return fail(500, { error: 'Failed to delete dream.' });
    }
  },

  regenerate: async ({ locals, params }) => {
    if (!locals.user) {
      return fail(401, { error: 'Unauthorized' });
    }

    const userId = locals.user.id;
    const dreamId = params.id;

    try {
      // Fetch the dream to ensure ownership and get raw_text
      const [dream] = await sql`
        SELECT raw_text
        FROM dreams
        WHERE id = ${dreamId} AND user_id = ${userId};
      `;

      if (!dream) {
        return fail(404, { error: 'Dream not found or access denied.' });
      }

      // Reset status and clear old results
      await sql`
        UPDATE dreams
        SET status = 'pending_analysis', tags = NULL, interpretation = NULL
        WHERE id = ${dreamId};
      `;

      // Re-trigger n8n workflow
      const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dreamId, rawText: dream.raw_text }),
      });

      if (!n8nResponse.ok) {
        await sql`
          UPDATE dreams
          SET status = 'analysis_failed'
          WHERE id = ${dreamId};
        `;
        return fail(500, { error: 'Failed to regenerate analysis. Please try again.' });
      }

      // Parse and update with new results
      const analysisData = await n8nResponse.json();
      const { tags, interpretation } = analysisData;

      if (!Array.isArray(tags) || typeof interpretation !== 'string') {
        await sql`
          UPDATE dreams
          SET status = 'analysis_failed'
          WHERE id = ${dreamId};
        `;
        return fail(500, { error: 'Invalid analysis response. Please try again.' });
      }

      await sql`
        UPDATE dreams
        SET tags = ${JSON.stringify(tags)}, interpretation = ${interpretation}, status = 'completed'
        WHERE id = ${dreamId};
      `;

      return { success: true };
    } catch (e) {
      console.error('Error regenerating dream:', e);
      return fail(500, { error: 'Failed to regenerate analysis.' });
    }
  },
};
