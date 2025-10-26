import type { PageServerLoad, Actions } from './$types';
import { sql } from '$lib/server/db';
import { error, redirect, fail } from '@sveltejs/kit';

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
};
