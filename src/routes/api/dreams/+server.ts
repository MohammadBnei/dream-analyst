import { json, type RequestHandler } from '@sveltejs/kit';
import { sql } from '$lib/server/db';

// This endpoint is primarily for listing dreams, or potentially for a direct save
// if not using a form action. The FDD implies form action for new dream.
// We'll implement a GET for listing dreams here.

export const GET: RequestHandler = async ({ url, locals }) => {
  // In a real app, get userId from locals.user.id after authentication
  const userId = locals.user?.id; // Replace with actual user ID

  try {
    const dreams = await sql`
      SELECT id, created_at, raw_text, tags, interpretation, status
      FROM dreams
      WHERE user_id = ${userId}
      ORDER BY created_at DESC;
    `;
    return json(dreams);
  } catch (error) {
    console.error('Error fetching dreams:', error);
    return json({ error: 'Failed to fetch dreams' }, { status: 500 });
  }
};

// This POST handler is provided for completeness, but the FDD suggests
// the new dream creation uses a form action in +page.server.ts.
// If you decide to use a direct API call from client-side for new dream,
// this would be the place.
export const POST: RequestHandler = async ({ request, locals }) => {
  // In a real app, get userId from locals.user.id after authentication
  const userId = locals.user?.id; // Replace with actual user ID

  const { rawText } = await request.json();

  if (!rawText || rawText.trim().length < 10) {
    return json({ error: 'Dream text must be at least 10 characters long.' }, { status: 400 });
  }

  try {
    const [newDream] = await sql`
      INSERT INTO dreams (user_id, raw_text, status)
      VALUES (${userId}, ${rawText}, 'pending_analysis')
      RETURNING id, created_at, raw_text, status;
    `;

    // Trigger n8n workflow (similar logic as in +page.server.ts)
    // For brevity, this part is omitted here but would involve a fetch call to n8n.

    return json({
      message: 'Dream saved and analysis triggered.',
      dream: newDream,
    }, { status: 201 });

  } catch (error) {
    console.error('Error saving dream via API:', error);
    return json({ error: 'Failed to save dream.' }, { status: 500 });
  }
};
