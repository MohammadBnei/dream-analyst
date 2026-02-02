import { json } from '@sveltejs/kit';
import { analyticsService } from '$lib/server/services';
import type { RequestHandler } from './$types';

/**
 * GET /api/analytics/activity
 * Returns dream activity over time.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const range = url.searchParams.get('range') || '30d';
	const granularity = (url.searchParams.get('granularity') || 'day') as 'day' | 'week' | 'month';

	const activity = await analyticsService.getDreamActivity(locals.user.userId, range, granularity);

	return json(activity);
};
