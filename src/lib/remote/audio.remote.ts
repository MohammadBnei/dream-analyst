import { command } from '$app/server';
import { initiateAudioTranscription } from '$lib/server/n8nService';
import * as v from 'valibot';

// Define the schema for the input to the remote function
// We expect a File object and a language string
const transcribeAudioSchema = v.object({
    audioFile: v.instance(File),
    lang: v.string()
});

export const transcribeAudio = command(
    transcribeAudioSchema,
    async ({ audioFile, lang }) => {
        try {
            const result = await initiateAudioTranscription(audioFile, lang);
            return result.transcription;
        } catch (error) {
            console.error('Error in remote transcribeAudio function:', error);
            throw new Error(`Transcription failed: ${(error as Error).message}`);
        }
    }
);
