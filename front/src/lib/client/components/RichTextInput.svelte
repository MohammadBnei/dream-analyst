<script lang="ts">
	import * as m from '$lib/paraglide/messages';

	interface Props {
		value?: string;
		placeholder?: string;
		rows?: number;
		/** Called with the textarea's current value on every input. */
		onInput?: (value: string) => void;
		name?: string;
		id?: string;
	}

	let {
		value = $bindable(''),
		placeholder = m.describe_dream_placeholder(),
		rows = 5,
		onInput = () => {},
		name = 'rawText',
		id
	}: Props = $props();

	let isRecording = $state(false);
	let recordingError: string | null = $state(null);
	let isTranscribing = $state(false);
	/** True between the click and audio actually being captured. Even fully
	 *  warmed, getUserMedia takes 100-300ms, and a button that looks ready while
	 *  the graph is still being built invites the words that then go missing. */
	let isArming = $state(false);
	let selectedLanguage: 'en' | 'fr' = $state('fr');

	// Streaming dictation. Text arrives roughly 560ms behind speech instead of
	// after you stop, because the server keeps encoder state between chunks —
	// so this sends ~560ms slices IN ORDER rather than one file at the end.
	//
	// Deliberately NOT Svelte 5 runes: this component is still Svelte 4 syntax
	// in an otherwise-runes codebase, and migrating it is a separate change
	// from changing what it does.
	let dictation: { start: () => Promise<void>; stop: () => Promise<void> } | null = null;
	let streamId = '';
	/** Where transcribed text began, so appended chunks land in one place even
	 *  if the user keeps typing above it. */
	let appendedAny = false;

	async function sendChunk(pcm: Uint8Array, last: boolean) {
		const qs = new URLSearchParams({
			lang: selectedLanguage,
			stream: streamId,
			last: last ? '1' : '0'
		});
		const response = await fetch(`/api/transcribe?${qs}`, {
			method: 'POST',
			headers: { 'content-type': 'application/octet-stream' },
			body: pcm as unknown as BodyInit
		});
		if (!response.ok) {
			let message = `HTTP ${response.status}`;
			try {
				message = (await response.json()).message || message;
			} catch {
				/* the error body is not always JSON */
			}
			throw new Error(message);
		}
		const { transcription } = await response.json();
		if (transcription) {
			value = (value && !appendedAny ? value + '\n' : value) + transcription;
			appendedAny = true;
			onInput(value);
		}
	}

	/** Build the AudioContext and compile the worklet BEFORE the click.
	 *
	 *  Neither touches the microphone, so this asks for no permission and lights
	 *  no recording indicator — which is exactly why it can run on hover, before
	 *  the user has committed to anything. Without it the click path is: fetch
	 *  this module, construct a context, compile a worklet, THEN open the
	 *  device — and the first words of the sentence land in that gap and are
	 *  never captured. Memoised upstream, so repeated hovers are free. */
	function warm() {
		void import('$lib/client/audio/stt-capture.js')
			.then((mod) => mod.prewarm())
			.catch(() => {
				/* warming is an optimisation; startRecording surfaces real failures */
			});
	}

	async function startRecording() {
		recordingError = null;
		isArming = true;
		appendedAny = false;
		streamId = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now());
		try {
			const { createDictation } = await import('$lib/client/audio/stt-capture.js');
			dictation = createDictation({
				send: sendChunk,
				// A failed chunk abandons the stream rather than retrying it:
				// ordering is load-bearing, so a re-sent chunk arriving after a
				// later one would corrupt everything following it.
				onError: ((e: Error) => {
					recordingError = m.transcription_failed_message({ message: e.message });
					stopRecording();
				}) as () => void
			});
			await dictation.start();
			isRecording = true;
		} catch (err) {
			console.error('Error accessing microphone:', err);
			recordingError = m.microphone_access_error();
			isRecording = false;
			dictation = null;
		} finally {
			isArming = false;
		}
	}

	async function stopRecording() {
		// `isTranscribing` guards re-entry: the button stays mounted while stop()
		// awaits the final chunk, and a second click would run the teardown twice.
		if (!dictation || isTranscribing) return;
		isRecording = false;
		// stop() flushes the final partial chunk and waits for it to land, so
		// the UI is only re-enabled once the last words have actually arrived.
		isTranscribing = true;
		try {
			await dictation.stop();
		} catch (err) {
			recordingError = m.transcription_failed_message({
				message: err instanceof Error ? err.message : 'Unknown error'
			});
		} finally {
			dictation = null;
			isTranscribing = false;
		}
	}

	function handleInput(event: Event) {
		value = (event.target as HTMLTextAreaElement).value;
		onInput(value); // Call the callback prop
	}
</script>

<div class="">
	<div class="mt-2 w-full">
		<fieldset class="fieldset rounded-box border border-base-300 bg-base-200 p-4">
			<legend class="fieldset-legend">{m.audio_input_fieldset_legend()}</legend>
			<textarea
				{id}
				{placeholder}
				{rows}
				{name}
				bind:value
				oninput={handleInput}
				class="textarea-bordered textarea w-full rounded-md p-2 focus:ring-2 focus:ring-primary focus:outline-none"
			></textarea>
			<div class="flex items-center space-x-2">
				<button
					onclick={isRecording ? stopRecording : startRecording}
					onpointerenter={warm}
					onpointerdown={warm}
					onfocus={warm}
					type="button"
					disabled={isTranscribing || isArming}
					class="btn {isRecording || isTranscribing ? 'btn-error' : 'btn-primary'} btn-sm"
				>
					{#if isRecording}
						<svg
							class="inline-block h-5 w-5"
							fill="currentColor"
							viewBox="0 0 20 20"
							xmlns="http://www.w3.org/2000/svg"
							><path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.75 7.75a.75.75 0 00-1.5 0v4.5a.75.75 0 001.5 0v-4.5zM12.25 7.75a.75.75 0 00-1.5 0v4.5a.75.75 0 001.5 0v-4.5z"
								clip-rule="evenodd"
							></path></svg
						>
						{m.stop_recording_button()}
					{:else if isTranscribing}
						<svg
							class="inline-block h-5 w-5"
							fill="currentColor"
							viewBox="0 0 20 20"
							xmlns="http://www.w3.org/2000/svg"
							><path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.75 7.75a.75.75 0 00-1.5 0v4.5a.75.75 0 001.5 0v-4.5zM12.25 7.75a.75.75 0 00-1.5 0v4.5a.75.75 0 001.5 0v-4.5z"
								clip-rule="evenodd"
							></path></svg
						>
						{m.cancel_transcription_button()}
					{:else if isArming}
						<span class="loading loading-xs loading-spinner"></span>
						{m.starting_recording_button()}
					{:else}
						<svg
							class="inline-block h-5 w-5"
							fill="currentColor"
							viewBox="0 0 20 20"
							xmlns="http://www.w3.org/2000/svg"
							><path
								d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.25 1.25 0 01-2.095-1.15l.003-.003.002-.002A6.25 6.25 0 0110 10c2.817 0 5.323 1.39 6.827 3.513l.002.002.003.003a1.25 1.25 0 01-2.095 1.15 3.75 3.75 0 00-9.564 0z"
							></path></svg
						>
						{m.record_audio_button()}
					{/if}
				</button>

				<select
					bind:value={selectedLanguage}
					class="select-bordered select w-30 select-sm"
					disabled={isRecording || isTranscribing}
				>
					<option value="en">{m.language_english_option()}</option>
					<option value="fr">{m.language_french_option()}</option>
				</select>
			</div>
		</fieldset>

		{#if isTranscribing}
			<p class="flex items-center gap-2 text-info">
				<span class="loading loading-sm loading-spinner"></span>
				{m.transcribing_audio_message()}
			</p>
		{/if}
	</div>

	{#if recordingError}
		<div role="alert" class="mt-2 alert alert-error">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-6 w-6 shrink-0 stroke-current"
				fill="none"
				viewBox="0 0 24 24"
				><path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
				/></svg
			>
			<span>{recordingError}</span>
		</div>
	{/if}
</div>
