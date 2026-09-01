import { json, error } from '@sveltejs/kit';
import {
	transcribeChunk,
	sessionIdFor,
	SttError
} from '$lib/server/infrastructure/transcription/sttService';
import type { RequestHandler } from './$types';

/**
 * Streaming dictation, proxied server-side.
 *
 * The browser never holds an STT credential: it is authenticated to THIS app by
 * its own session cookie, and this route calls ukubi-stt with the app's own
 * service token. That is why there is no CORS anywhere in the chain, and why a
 * token rotation cannot silently 401 a user mid-sentence (ADR-0046).
 *
 * Body is raw 16 kHz mono little-endian s16 PCM — one ~560 ms chunk per request.
 * Not multipart, not JSON: SvelteKit's remote-function transport devalues *and*
 * base64-encodes its argument, which is ~4.9x expansion for a number[] and still
 * ~1.78x for a Uint8Array. At roughly two requests a second that is paid
 * continuously, so the raw body is worth the plainness.
 */

/** ~8 min of audio; the service itself caps a request at 16MB. */
const MAX_BODY_BYTES = 10 * 1024 * 1024;

/**
 * Retries live here, not in the browser: the audio is already uploaded, so a
 * server-side retry is free while a client-side one re-sends megabytes.
 *
 * Only for RESOURCE_EXHAUSTED and transport failure. Never for INVALID_ARGUMENT
 * — that means the PCM is malformed and it will be malformed again.
 *
 * NOTE this applies to the batch path. A streaming chunk is NOT retried: order
 * is load-bearing because the encoder carries cache forward, so a re-sent chunk
 * arriving after a later one corrupts the transcript. Streaming callers get the
 * error and abandon the stream.
 */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
	let lastError: unknown;
	for (let i = 0; i < attempts; i++) {
		try {
			return await fn();
		} catch (e) {
			lastError = e;
			if (!(e instanceof SttError) || !e.retryable) throw e;
			if (i < attempts - 1) {
				const backoff = 400 * 2 ** i + Math.random() * 200;
				await new Promise((r) => setTimeout(r, backoff));
			}
		}
	}
	throw lastError;
}

export const POST: RequestHandler = async ({ request, locals, url }) => {
	const sessionUser = locals.user;
	if (!sessionUser) {
		throw error(401, 'Unauthorized');
	}

	const lang = url.searchParams.get('lang') || 'en';
	const streamId = url.searchParams.get('stream') || '';
	const last = url.searchParams.get('last') === '1';

	const body = Buffer.from(await request.arrayBuffer());
	if (body.byteLength > MAX_BODY_BYTES) {
		throw error(413, 'Audio chunk too large');
	}
	// An empty body is only meaningful as a close: it tells the service to flush
	// the encoder's own buffered tail and release the recognizer.
	if (body.byteLength === 0 && !last) {
		throw error(400, 'No audio provided');
	}

	// The client picks a stream id per dictation, but never the id the service
	// sees — that is derived from it and the authenticated user, so one user
	// cannot join another's recognizer by guessing.
	const sessionId = streamId ? sessionIdFor(String(sessionUser.id), streamId) : '';

	try {
		const result = streamId
			? await transcribeChunk(body, sessionId, last, lang)
			: await withRetry(() => transcribeChunk(body, '', false, lang));
		return json({
			transcription: result.text,
			audioSeconds: result.audioSeconds,
			decodeSeconds: result.decodeSeconds
		});
	} catch (e) {
		console.error('Error in /api/transcribe endpoint:', e);
		if (e instanceof SttError) {
			// 503 for anything the caller could sensibly retry later; the service
			// is single-replica on one GPU node by design (ADR-0044) and being
			// unavailable is a normal state, not an internal error.
			throw error(e.retryable ? 503 : 500, `Transcription failed: ${e.message}`);
		}
		throw error(500, 'An unknown error occurred during transcription.');
	}
};
