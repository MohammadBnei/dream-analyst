import { json } from '@sveltejs/kit';
import { symbolService } from '$lib/server/services';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const symbols = await symbolService.getSymbolsForDream(params.id);
	return json(symbols);
};

export const POST: RequestHandler = async ({ params, request }) => {
	const { symbolName, sentiment, contextNote, prominence } = await request.json();

	const occurrence = await symbolService.createOccurrence({
		dreamId: params.id,
		symbolName,
		sentiment,
		contextNote,
		prominence
	});

	return json(occurrence);
};
