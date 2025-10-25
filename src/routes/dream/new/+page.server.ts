import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { sql } from '$lib/server/db';
import { env } from '$env/dynamic/private';
import { v4 as uuidv4 } from 'uuid';

// Placeholder for n8n webhook URL
const N8N_WEBHOOK_URL = env.N8N_WEBHOOK_URL || 'https://your-n8n-instance.com/webhook/dream-analysis';

export const load: PageServerLoad = async ({ locals }) => {
  // In a real app, you'd check if the user is authenticated
  // For now, we assume a user is "logged in" via the layout.server.ts placeholder
  // if (!locals.user) {
  //   throw redirect(302, '/login');
  // }
  return {};
};

export const actions: Actions = {
  saveDream: async ({ request, locals }) => {
    // In a real app, get userId from locals.user.id after authentication
    const userId = 'user-id-placeholder'; // Replace with actual user ID

    const data = await request.formData();
    const dreamText = data.get('dreamText')?.toString();

    if (!dreamText || dreamText.trim().length < 10) {
      return fail(400, { error: 'Dream text must be at least 10 characters long.' });
    }

    let dreamId: string;
    try {
      // Insert dream into the database with pending_analysis status
      const [newDream] = await sql`
        INSERT INTO dreams (id, user_id, raw_text, status)
        VALUES (${uuidv4()}, ${userId}, ${dreamText}, 'pending_analysis')
        RETURNING id;
      `;
      dreamId = newDream.id;
    } catch (dbError) {
      console.error('Database error saving dream:', dbError);
      return fail(500, { error: 'Failed to save dream to database.' });
    }

    // Trigger n8n workflow for analysis
    try {
      const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dreamId, rawText: dreamText }),
      });

      if (!n8nResponse.ok) {
        const errorBody = await n8nResponse.text();
        console.error(`n8n webhook failed for dream ${dreamId}: ${n8nResponse.status} - ${errorBody}`);
        // Update dream status to analysis_failed if n8n call fails
        await sql`
          UPDATE dreams
          SET status = 'analysis_failed'
          WHERE id = ${dreamId};
        `;
        return fail(500, { error: 'Failed to trigger dream analysis. Please try again later.' });
      }

      // n8n will call back to /api/dreams/[id]/result with the actual analysis.
      // For now, we can return a success message and let the client poll or wait for updates.
      // Or, if n8n returns the analysis directly (less ideal for async processing),
      // we could process it here. Assuming async callback for now.

      // For immediate feedback, we might simulate a quick analysis or return a "pending" state.
      // The client-side Svelte component will handle showing "Analyzing..."
      return { success: true, message: 'Dream saved and analysis triggered.' };

    } catch (n8nError) {
      console.error('Error calling n8n webhook:', n8nError);
      // Update dream status to analysis_failed if n8n call fails
      await sql`
        UPDATE dreams
        SET status = 'analysis_failed'
        WHERE id = ${dreamId};
      `;
      return fail(500, { error: 'Failed to trigger dream analysis due to network error.' });
    }
  },
};
