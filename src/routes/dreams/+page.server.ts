import type { PageServerLoad } from './$types';
import { sql } from '$lib/server/db';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
  // In a real app, get userId from locals.user.id after authentication
  const userId = 'user-id-placeholder'; // Replace with actual user ID

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
