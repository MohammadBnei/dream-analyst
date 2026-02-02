import { json } from '@sveltejs/kit';
import { metaAnalystService } from '$lib/server/services';
import type { RequestHandler } from './$types';

/**
 * GET /api/insights/unread-count
 * Get count of unread insight reports for the user.
 */
export const GET: RequestHandler = async ({ locals }) => {
	const count = await metaAnalystService.countUnreadReports(locals.user.userId);
	return json({ count });
};
