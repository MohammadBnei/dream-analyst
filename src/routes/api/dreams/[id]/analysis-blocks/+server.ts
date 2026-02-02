import { json } from '@sveltejs/kit';
import { getPrismaClient } from '$lib/server/db';
import type { RequestHandler } from './$types';

/**
 * GET /api/dreams/[id]/analysis-blocks
 * Returns structured analysis blocks for a dream.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const prisma = await getPrismaClient();

	const dream = await prisma.dream.findFirst({
		where: {
			id: params.id,
			userId: locals.user.userId
		},
		select: {
			id: true,
			analysisVersion: true,
			structuredAnalysis: true,
			interpretation: true
		}
	});

	if (!dream) {
		return json({ error: 'Dream not found' }, { status: 404 });
	}

	// If structured analysis exists, return it
	if (dream.analysisVersion === 2 && dream.structuredAnalysis) {
		return json({
			version: 2,
			analysis: dream.structuredAnalysis
		});
	}

	// Fallback: return markdown as single block
	return json({
		version: 1,
		analysis: {
			version: 1,
			summary: 'Legacy analysis',
			analysisBlocks: [
				{
					id: 'legacy_block',
					type: 'summary',
					title: 'Dream Analysis',
					content: dream.interpretation || 'No analysis available'
				}
			]
		}
	});
};
