import { type Actions, fail, redirect } from '@sveltejs/kit';
import { sql } from '$lib/server/db';
import type { PageServerLoad } from './$types';
import { triggerDreamAnalysis } from '$lib/server/n8nService'; // Import the new service

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(302, '/login');
  }
  return {};
};

export const actions: Actions = {
  saveDream: async ({ request, locals }) => {
    if (!locals.user) {
      return fail(401, { error: 'Unauthorized' });
    }

    const userId = locals.user.userId; // Use userId from locals.user

    const data = await request.formData();
    const dreamText = data.get('dreamText')?.toString();

    if (!dreamText || dreamText.trim().length < 10) {
      return fail(400, { error: 'Dream text must be at least 10 characters long.' });
    }

    let dreamId: string;
    try {
      // Insert dream into the database with pending_analysis status
      const [newDream] = await sql`
        INSERT INTO dreams (user_id, raw_text, status)
        VALUES (${userId}, ${dreamText}, 'pending_analysis')
        RETURNING id;
      `;
      dreamId = newDream.id;
    } catch (dbError) {
      console.error('Database error saving dream:', dbError);
      return fail(500, { error: 'Failed to save dream to database.' });
    }

    // Trigger n8n workflow for analysis and wait for the response
    try {
      const analysisData = await triggerDreamAnalysis(dreamId, dreamText);
      const { tags, interpretation } = analysisData;

      // Update the dream with analysis results and set status to completed
      await sql`
        UPDATE dreams
        SET tags = ${JSON.stringify(tags)}, interpretation = ${interpretation}, status = 'completed'
        WHERE id = ${dreamId};
      `;

      // Return success with the analysis result for immediate display
      return { success: true, analysisResult: { tags, interpretation } };

    } catch (n8nError: any) {
      console.error('Error during dream analysis:', n8nError);
      // Update dream status to analysis_failed if n8n call fails
      await sql`
        UPDATE dreams
        SET status = 'analysis_failed'
        WHERE id = ${dreamId};
      `;
      return fail(500, { error: n8nError.message || 'Failed to analyze dream.' });
    }
  },
};
