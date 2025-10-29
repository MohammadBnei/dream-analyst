<script lang="ts">
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
    let abortController: AbortController | null = null; // To manage transcription cancellation

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
        if (isRecording && mediaRecorder) {
            mediaRecorder.stop();
        } else if (isTranscribing && abortController) {
            // If not recording but transcribing, cancel the transcription
            abortController.abort();
            console.log('Transcription cancelled by user.');
            recordingError = 'Transcription cancelled.';
            isTranscribing = false;
            abortController = null;
        }
    }

    async function transcribeAndAppend(audioBlob: Blob) {
        isTranscribing = true;
        recordingError = null; // Clear previous errors
        abortController = new AbortController(); // Create a new AbortController for this transcription
        const { signal } = abortController;

        try {
            const formData = new FormData();
            formData.append('audio', audioBlob, `audio-${Date.now()}.webm`);

            const response = await fetch(`/api/transcribe?lang=${selectedLanguage}`, {
                method: 'POST',
                body: formData,
                signal // Pass the abort signal to the fetch request
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to transcribe audio');
            }

            const result = await response.json();
            const transcription = result.transcription;

            if (transcription) {
                value = (value ? value + '\n' : '') + transcription;
                onInput(value); // Call the callback prop
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('Fetch aborted by user.');
                recordingError = 'Transcription cancelled.';
            } else {
                console.error('Transcription error:', error);
                recordingError = 'Transcription failed: ' + (error.message || 'Unknown error');
            }
        } finally {
            isTranscribing = false;
            abortController = null; // Clear the controller
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
        class="textarea textarea-bordered w-full p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
    ></textarea>

    <div class="flex items-center justify-between mt-2">
        <div class="flex items-center space-x-2">
            <button
                on:click={isRecording || isTranscribing ? stopRecording : startRecording}
                type="button"
                class="btn {isRecording || isTranscribing ? 'btn-error' : 'btn-primary'} btn-sm"
            >
                {#if isRecording}
                    <svg class="w-5 h-5 inline-block" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.75 7.75a.75.75 0 00-1.5 0v4.5a.75.75 0 001.5 0v-4.5zM12.25 7.75a.75.75 0 00-1.5 0v4.5a.75.75 0 001.5 0v-4.5z" clip-rule="evenodd"></path></svg>
                    Stop Recording
                {:else if isTranscribing}
                    <svg class="w-5 h-5 inline-block" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.75 7.75a.75.75 0 00-1.5 0v4.5a.75.75 0 001.5 0v-4.5zM12.25 7.75a.75.75 0 00-1.5 0v4.5a.75.75 0 001.5 0v-4.5z" clip-rule="evenodd"></path></svg>
                    Cancel Transcription
                {:else}
                    <svg class="w-5 h-5 inline-block" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.25 1.25 0 01-2.095-1.15l.003-.003.002-.002A6.25 6.25 0 0110 10c2.817 0 5.323 1.39 6.827 3.513l.002.002.003.003a1.25 1.25 0 01-2.095 1.15 3.75 3.75 0 00-9.564 0z"></path></svg>
                    Record Audio
                {/if}
            </button>

            <select bind:value={selectedLanguage} class="select select-bordered select-sm" disabled={isRecording || isTranscribing}>
                <option value="en">English</option>
                <option value="fr">Français</option>
            </select>
        </div>

        {#if isTranscribing}
            <p class="text-info flex items-center gap-2">
                <span class="loading loading-spinner loading-sm"></span>
                Transcribing audio...
            </p>
        {/if}
    </div>

    {#if recordingError}
        <div role="alert" class="alert alert-error mt-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>{recordingError}</span>
        </div>
    {/if}
</div>

<style>
    /* No custom styles needed, relying on DaisyUI and Tailwind CSS */
</style>
