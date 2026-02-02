import { json } from '@sveltejs/kit';
import { metaAnalystService } from '$lib/server/services';
import type { RequestHandler } from './$types';

/**
 * GET /api/insights
 * Get user's insight reports (optionally filter by unread).
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const unreadOnly = url.searchParams.get('unread') === 'true';
	const limit = parseInt(url.searchParams.get('limit') || '20');
	const offset = parseInt(url.searchParams.get('offset') || '0');

	const reports = unreadOnly
		? await metaAnalystService.getUnreadReports(locals.user.userId)
		: await metaAnalystService.getAllReports(locals.user.userId, limit, offset);

	return json(reports);
};
