import { json } from '@sveltejs/kit';
import { analyticsService } from '$lib/server/services';
import type { RequestHandler } from './$types';

/**
 * GET /api/analytics/credit-usage
 * Returns credit usage analytics.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const range = url.searchParams.get('range') || '30d';

	const usage = await analyticsService.getCreditUsage(locals.user.userId, range);

	return json(usage);
};
