import type { PageServerLoad, Actions } from './$types';
import { sql } from '$lib/server/db';
import { error, redirect, fail } from '@sveltejs/kit';
import { triggerDreamAnalysis } from '$lib/server/n8nService'; // Import the new service

export const load: PageServerLoad = async ({ locals, params }) => {
  if (!locals.user) {
    throw redirect(302, '/login');
  }

  const userId = locals.user.userId; // Use userId from locals.user
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

    const userId = locals.user.userId; // Use userId from locals.user
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

    const userId = locals.user.userId; // Use userId from locals.user
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

      // Use the new n8n service
      const analysisData = await triggerDreamAnalysis(dreamId, dream.raw_text);
      const { tags, interpretation } = analysisData;

      await sql`
        UPDATE dreams
        SET tags = ${JSON.stringify(tags)}, interpretation = ${interpretation}, status = 'completed'
        WHERE id = ${dreamId};
      `;

      return { success: true };
    } catch (e: any) {
      console.error('Error regenerating dream:', e);
      // Update dream status to analysis_failed if n8n call fails
      await sql`
        UPDATE dreams
        SET status = 'analysis_failed'
        WHERE id = ${dreamId};
      `;
      return fail(500, { error: e.message || 'Failed to regenerate analysis.' });
    }
  },
};
