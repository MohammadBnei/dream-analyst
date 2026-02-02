import { json } from '@sveltejs/kit';
import { symbolService } from '$lib/server/services';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const progression = await symbolService.getSymbolProgression(params.id, locals.user.userId);
	return json(progression);
};
