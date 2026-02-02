import { json } from '@sveltejs/kit';
import { analyticsService } from '$lib/server/services';
import type { RequestHandler } from './$types';

/**
 * GET /api/analytics/stats
 * Returns user's overall statistics.
 */
export const GET: RequestHandler = async ({ locals }) => {
	const stats = await analyticsService.getUserStats(locals.user.userId);

	return json(stats);
};
