import { command, getRequestEvent } from '$app/server';
import { initiateAudioTranscription } from '$lib/server/n8nService';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';

// A SvelteKit `command` compiles to an addressable POST endpoint, so it is
// reachable whether or not any component imports it. This one had no caller and
// no auth check at all, which left audio transcription — and the n8n spend
// behind it — open to anyone who found the route on a public host.
//
// Duplicated from dream.remote.ts rather than extracted: there is no shared
// helper today (`lib/server/auth.ts` is JWT/cookie primitives, and this one is
// private), and hoisting it would touch dream.remote.ts, which the open refactor
// PR #10 also modifies. Extract once that lands.
async function getCurrentUser() {
	const event = getRequestEvent();
	if (!event?.locals.user) {
		error(401, 'Unauthorized');
	}
	return event.locals.user;
}

// Define the schema for the input to the remote function
// We expect the audio data as a number array (Uint8Array converted to plain array for serialization),
// and the file's name and type.
const transcribeAudioSchema = v.object({
	audioData: v.array(v.number()), // Represents Uint8Array as a plain array of numbers
	fileName: v.string(),
	fileType: v.string(),
	lang: v.string()
});

export const transcribeAudio = command(
	transcribeAudioSchema,
	async ({ audioData, fileName, fileType, lang }) => {
		await getCurrentUser();
		try {
			// Reconstruct the Blob/File object on the server side
			const audioBlob = new Blob([new Uint8Array(audioData)], { type: fileType });
			const audioFile = new File([audioBlob], fileName, { type: fileType });

			const result = await initiateAudioTranscription(audioFile, lang);
			return result.transcription;
		} catch (e) {
			// `e`, not `error` — this file now imports `error` from
			// @sveltejs/kit, and shadowing it here would hide the helper that
			// throws the 401. dream.remote.ts uses `e` for the same reason.
			console.error('Error in remote transcribeAudio function:', e);
			throw new Error(`Transcription failed: ${(e as Error).message}`);
		}
	}
);
