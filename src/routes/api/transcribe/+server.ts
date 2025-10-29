import { json, error } from '@sveltejs/kit';
import { initiateAudioTranscription } from '$lib/server/n8nService';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, url }) => {
    const sessionUser = locals.user;

    if (!sessionUser) {
        throw error(401, 'Unauthorized');
    }

    const lang = url.searchParams.get('lang') || 'en';

    try {
        const formData = await request.formData();
        const audioFile = formData.get('audio');

        if (!audioFile || !(audioFile instanceof File)) {
            throw error(400, 'No audio file provided or file is not valid.');
        }

        // Call the n8n service with the received audio file and language
        const transcriptionResult = await initiateAudioTranscription(audioFile, lang);

        return json({ transcription: transcriptionResult.transcription });
    } catch (e) {
        console.error('Error in /api/transcribe endpoint:', e);
        if (e instanceof Error) {
            throw error(500, `Transcription failed: ${e.message}`);
        }
        throw error(500, 'An unknown error occurred during transcription.');
    }
};
