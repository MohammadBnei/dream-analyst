import { env } from '$env/dynamic/private';
import type { Dream } from '@prisma/client'; // Keep if Dream type is used elsewhere, otherwise can remove

// Removed N8N_WEBHOOK_URL and N8N_AUTH as they are no longer used for analysis streaming
const N8N_AUDIO_TRANSCRIBE_URL = env.N8N_AUDIO_TRANSCRIBE_URL; // New environment variable for audio transcription

// Removed AnalysisStreamChunk interface as it's now defined in langchainService.ts or a shared type file.
// If Dream['status'] is still needed for audio transcription, keep the import.

// Removed initiateStreamedDreamAnalysis function

export async function initiateAudioTranscription(audioFile: Blob | File, lang: string = 'en'): Promise<{ transcription: string }> {
    if (!N8N_AUDIO_TRANSCRIBE_URL) {
        throw new Error("N8N_AUDIO_TRANSCRIBE_URL is not defined");
    }

    const formData = new FormData();
    // Changed 'file' to 'audio' to match the endpoint's expectation
    formData.append('audio', audioFile);

    // N8N_AUTH is not used for audio transcription in the original code, so it's not added here.
    // If your n8n audio transcription webhook requires authentication, you'd need to add it.
    const headers: HeadersInit = {};
    // Example if N8N_AUTH was needed for transcription:
    // if (env.N8N_AUTH) {
    //     headers['N8N_AUTH'] = env.N8N_AUTH;
    // }

    const url = new URL(N8N_AUDIO_TRANSCRIBE_URL);
    url.searchParams.append('lang', lang);

    try {
        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: headers, // FormData handles Content-Type: multipart/form-data automatically
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`n8n audio transcription call failed: ${response.status} - ${errorText}`);
            throw new Error(`Failed to transcribe audio: ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        if (typeof result.text !== 'string') {
            console.error('n8n audio transcription response did not contain a string "text":', result);
            throw new Error('Invalid response from audio transcription service.');
        }

        return { transcription: result.text };

    } catch (error) {
        console.error('Error initiating n8n audio transcription:', error);
        throw new Error(`Failed to initiate audio transcription service: ${(error as Error).message}`);
    }
}
