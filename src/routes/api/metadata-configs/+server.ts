import { json } from '@sveltejs/kit';
import { metadataConfigService } from '$lib/server/services';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const templates = await metadataConfigService.getGlobalTemplates();
	return json(templates);
};
