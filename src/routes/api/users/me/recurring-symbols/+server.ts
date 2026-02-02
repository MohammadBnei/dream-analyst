import { json } from '@sveltejs/kit';
import { symbolService } from '$lib/server/services';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	const minOccurrences = parseInt(url.searchParams.get('min') ?? '3');
	const symbols = await symbolService.getUserRecurringSymbols(locals.user.userId, minOccurrences);
	return json(symbols);
};
