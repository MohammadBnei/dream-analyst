import { command } from '$app/server';
import { initiateAudioTranscription } from '$lib/server/n8nService';
import * as v from 'valibot';

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
        try {
            // Reconstruct the Blob/File object on the server side
            const audioBlob = new Blob([new Uint8Array(audioData)], { type: fileType });
            const audioFile = new File([audioBlob], fileName, { type: fileType });

            const result = await initiateAudioTranscription(audioFile, lang);
            return result.transcription;
        } catch (error) {
            console.error('Error in remote transcribeAudio function:', error);
            throw new Error(`Transcription failed: ${(error as Error).message}`);
        }
    }
);
