<script lang="ts">
    import { transcribeAudio } from '$lib/remote/audio.remote';

    export let value: string = '';
    export let placeholder: string = 'Start typing or record your thoughts...';
    export let rows: number = 5;
    export let onInput: (value: string) => void = () => {}; // Callback prop for input changes

    let isRecording = false;
    let mediaRecorder: MediaRecorder | null = null;
    let audioChunks: Blob[] = [];
    let recordingError: string | null = null;
    let isTranscribing = false;
    let selectedLanguage: 'en' | 'fr' = 'en';

    async function startRecording() {
        recordingError = null;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                isRecording = false;
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                await transcribeAndAppend(audioBlob);
                // Stop all tracks to release microphone
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event);
                recordingError = 'Recording failed: ' + (event.error?.message || 'Unknown error');
                isRecording = false;
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            isRecording = true;
        } catch (err) {
            console.error('Error accessing microphone:', err);
            recordingError = 'Could not access microphone. Please ensure it is connected and permissions are granted.';
            isRecording = false;
        }
    }

    function stopRecording() {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
        }
    }

    async function transcribeAndAppend(audioBlob: Blob) {
        isTranscribing = true;
        try {
            // Create a File object from the Blob for the remote function
            const audioFile = new File([audioBlob], `audio-${Date.now()}.webm`, { type: audioBlob.type });
            const transcription = await transcribeAudio({ audioFile, lang: selectedLanguage });

            if (transcription) {
                value = (value ? value + '\n' : '') + transcription;
                onInput(value); // Call the callback prop
            }
        } catch (error) {
            console.error('Transcription error:', error);
            recordingError = 'Transcription failed: ' + (error as Error).message;
        } finally {
            isTranscribing = false;
        }
    }

    function handleInput(event: Event) {
        value = (event.target as HTMLTextAreaElement).value;
        onInput(value); // Call the callback prop
    }
</script>

<div class="rich-text-input-container">
    <textarea
        {placeholder}
        {rows}
        bind:value
        on:input={handleInput}
        class="text-input w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
    ></textarea>

    <div class="flex items-center justify-between mt-2">
        <div class="flex items-center space-x-2">
            <button
                on:click={isRecording ? stopRecording : startRecording}
                disabled={isTranscribing}
                class="px-4 py-2 rounded-md text-white {isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'} disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {#if isRecording}
                    <svg class="w-5 h-5 inline-block mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.75 7.75a.75.75 0 00-1.5 0v4.5a.75.75 0 001.5 0v-4.5zM12.25 7.75a.75.75 0 00-1.5 0v4.5a.75.75 0 001.5 0v-4.5z" clip-rule="evenodd"></path></svg>
                    Stop Recording
                {:else}
                    <svg class="w-5 h-5 inline-block mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.25 1.25 0 01-2.095-1.15l.003-.003.002-.002A6.25 6.25 0 0110 10c2.817 0 5.323 1.39 6.827 3.513l.002.002.003.003a1.25 1.25 0 01-2.095 1.15 3.75 3.75 0 00-9.564 0z"></path></svg>
                    Record Audio
                {/if}
            </button>

            <select bind:value={selectedLanguage} class="p-2 border rounded-md">
                <option value="en">English</option>
                <option value="fr">Français</option>
            </select>
        </div>

        {#if isTranscribing}
            <p class="text-blue-600">Transcribing audio...</p>
        {/if}
    </div>

    {#if recordingError}
        <p class="text-red-500 mt-2">{recordingError}</p>
    {/if}
</div>

<style>
    /* Add any specific styles here if needed, or rely on Tailwind CSS */
</style>
