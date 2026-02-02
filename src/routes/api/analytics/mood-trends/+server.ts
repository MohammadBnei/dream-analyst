import { json } from '@sveltejs/kit';
import { analyticsService } from '$lib/server/services';
import type { RequestHandler } from './$types';

/**
 * GET /api/analytics/mood-trends
 * Returns mood trend data over time.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const range = url.searchParams.get('range') || '30d';

	const trends = await analyticsService.getMoodTrends(locals.user.userId, range);

	return json(trends);
};
