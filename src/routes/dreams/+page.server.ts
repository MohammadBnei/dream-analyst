import type { PageServerLoad, Actions } from './$types';
import { sql } from '$lib/server/db';
import { error, redirect, fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(302, '/login');
  }

  const userId = locals.user.id;

  try {
    const dreams = await sql`
      SELECT id, created_at, raw_text, tags, interpretation, status
      FROM dreams
      WHERE user_id = ${userId}
      ORDER BY created_at DESC;
    `;

    // Ensure tags are parsed correctly if stored as JSONB
    const parsedDreams = dreams.map(dream => ({
      ...dream,
      tags: dream.tags ? JSON.parse(dream.tags) : [], // Parse JSONB tags
    }));

    return {
      dreams: parsedDreams,
    };
  } catch (e) {
    console.error('Error loading dreams:', e);
    throw error(500, 'Could not load dreams.');
  }
};

export const actions: Actions = {
  delete: async ({ request, locals }) => {
    if (!locals.user) {
      return fail(401, { error: 'Unauthorized' });
    }

    const userId = locals.user.id;
    const data = await request.formData();
    const dreamId = data.get('dreamId') as string;

    if (!dreamId) {
      return fail(400, { error: 'Dream ID is required.' });
    }

    try {
      const [deletedDream] = await sql`
        DELETE FROM dreams
        WHERE id = ${dreamId} AND user_id = ${userId}
        RETURNING id;
      `;

      if (!deletedDream) {
        return fail(404, { error: 'Dream not found or access denied.' });
      }

      return { success: true };
    } catch (e) {
      console.error('Error deleting dream:', e);
      return fail(500, { error: 'Failed to delete dream.' });
    }
  },
};
