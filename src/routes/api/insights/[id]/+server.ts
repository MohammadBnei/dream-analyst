import { json } from '@sveltejs/kit';
import { metaAnalystService } from '$lib/server/services';
import type { RequestHandler } from './$types';

/**
 * GET /api/insights/[id]
 * Get specific insight report.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const report = await metaAnalystService.getReport(params.id, locals.user.userId);

	if (!report) {
		return json({ error: 'Report not found' }, { status: 404 });
	}

	return json(report);
};

/**
 * PATCH /api/insights/[id]
 * Mark report as read.
 */
export const PATCH: RequestHandler = async ({ params }) => {
	await metaAnalystService.markReportAsRead(params.id);
	return json({ success: true });
};
