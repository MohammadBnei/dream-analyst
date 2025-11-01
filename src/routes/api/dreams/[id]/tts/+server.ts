import { error } from '@sveltejs/kit';
import { getPrismaClient } from '$lib/server/db';
import { initiateTextToSpeech } from '$lib/server/n8nService';
import type { RequestHandler } from './$types';
import { getCreditService } from '$lib/server/creditService';

export const GET: RequestHandler = async ({ params, locals, request }) => {
	const dreamId = params.id;
	const sessionUser = locals.user;

	if (!sessionUser) {
		throw error(401, 'Unauthorized');
	}

	if (!dreamId) {
		throw error(400, 'Dream ID is required.');
	}

	const prisma = await getPrismaClient();
	const creditService = await getCreditService();

	try {
		const cost = creditService.getCost('DREAM_ANALYSIS_TTS')
		const check = await creditService.checkCredits(sessionUser.id, cost);

		if (!check) {
			throw error(402, 'Not enough credits');
		}

		const dream = await prisma.dream.findUnique({
			where: {
				id: dreamId,
				userId: sessionUser.id
			}
		});

		if (!dream) {
			throw error(404, 'Dream not found or you do not have permission to access it.');
		}

		if (!dream.interpretation) {
			throw error(400, 'No interpretation available for this dream.');
		}

		// Pass the request's signal to allow client-side abortion of the TTS generation
		const audioStream = await initiateTextToSpeech(dream.interpretation, request.signal);
		await creditService.deductCredits(sessionUser.id, cost, 'DREAM_ANALYSIS_TTS', dreamId);

		// Return the audio stream as a response
		return new Response(audioStream, {
			headers: {
				'Content-Type': 'audio/mpeg',
				'Content-Disposition': `inline; filename="dream_interpretation_${dreamId}.mp3"`, // Use 'inline' for streaming playback
				'Cache-Control': 'no-cache, no-store, must-revalidate', // Prevent caching
				'Pragma': 'no-cache',
				'Expires': '0'
			}
		});
	} catch (e: any) {
		console.error('Error generating or downloading interpretation audio:', e);
		// Check if the error is an AbortError from the client cancelling the request
		if (e.name === 'AbortError') {
			console.log('TTS stream aborted by client.');
			// Respond with a 204 No Content or similar if the client aborted
			return new Response(null, { status: 204 });
		}
		throw error(500, `Failed to generate audio: ${e.message || 'Unknown error'}`);
	}
};
