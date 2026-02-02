import { json } from '@sveltejs/kit';
import { analyticsService } from '$lib/server/services';
import type { RequestHandler } from './$types';

/**
 * GET /api/analytics/top-symbols
 * Returns most frequent symbols with sentiment data.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const limit = parseInt(url.searchParams.get('limit') || '10');

	const symbols = await analyticsService.getTopSymbols(locals.user.userId, limit);

	return json(symbols);
};
