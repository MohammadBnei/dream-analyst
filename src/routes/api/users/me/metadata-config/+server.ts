import { json } from '@sveltejs/kit';
import { metadataConfigService } from '$lib/server/services';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const schema = await metadataConfigService.getUserEffectiveSchema(locals.user.userId);
	return json({ effectiveSchema: schema });
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	const { configId } = await request.json();
	await metadataConfigService.setUserActiveConfig(locals.user.userId, configId);
	return json({ success: true });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const { schema } = await request.json();
	await metadataConfigService.setUserCustomSchema(locals.user.userId, schema);
	return json({ success: true });
};
