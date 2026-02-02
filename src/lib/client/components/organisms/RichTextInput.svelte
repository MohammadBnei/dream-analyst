<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import TextArea from '../atoms/TextArea.svelte';
	import Button from '../atoms/Button.svelte';
	import Select, { type SelectOption } from '../atoms/Select.svelte';
	import Icon from '../atoms/Icon.svelte';
	import Spinner from '../atoms/Spinner.svelte';
	import Alert from '../atoms/Alert.svelte';

	let {
		value = $bindable(''),
		placeholder = 'Start typing or record your thoughts...',
		rows = 5,
		onInput,
		name = 'rawText',
		legend = '',
		class: className = ''
	}: {
		value?: string;
		placeholder?: string;
		rows?: number;
		onInput?: (value: string) => void;
		name?: string;
		legend?: string;
		class?: string;
	} = $props();

	let isRecording = $state(false);
	let mediaRecorder = $state<MediaRecorder | null>(null);
	let audioChunks = $state<Blob[]>([]);
	let recordingError = $state<string | null>(null);
	let isTranscribing = $state(false);
	let selectedLanguage = $state<'en' | 'fr'>('fr');
	let abortController = $state<AbortController | null>(null);

	const languageOptions: SelectOption[] = [
		{ value: 'en', label: m.language_english_option() },
		{ value: 'fr', label: m.language_french_option() }
	];

	const isProcessing = $derived(isRecording || isTranscribing);

	async function startRecording() {
		recordingError = null;
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			mediaRecorder = new MediaRecorder(stream);
			audioChunks = [];

			if (mediaRecorder) {
				mediaRecorder.ondataavailable = (event) => {
					audioChunks.push(event.data);
				};

				mediaRecorder.onstop = async () => {
					isRecording = false;
					const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
					await transcribeAndAppend(audioBlob);
					stream.getTracks().forEach((track) => track.stop());
				};

				mediaRecorder.onerror = (event) => {
					console.error('MediaRecorder error:', event);
					recordingError = m.recording_failed_error({
						message: event.error?.message || 'Unknown error'
					});
					isRecording = false;
					stream.getTracks().forEach((track) => track.stop());
				};

				mediaRecorder.start();
				isRecording = true;
			}
		} catch (err) {
			console.error('Error accessing microphone:', err);
			recordingError = m.microphone_access_error();
			isRecording = false;
		}
	}

	function stopRecording() {
		if (isRecording && mediaRecorder) {
			mediaRecorder.stop();
		} else if (isTranscribing && abortController) {
			abortController.abort();
			console.log('Transcription cancelled by user.');
			recordingError = m.transcription_cancelled_message();
			isTranscribing = false;
			abortController = null;
		}
	}

	async function transcribeAndAppend(audioBlob: Blob) {
		isTranscribing = true;
		recordingError = null;
		abortController = new AbortController();
		const { signal } = abortController;

		try {
			const formData = new FormData();
			formData.append('audio', audioBlob, `audio-${Date.now()}.webm`);

			const response = await fetch(`/api/transcribe?lang=${selectedLanguage}`, {
				method: 'POST',
				body: formData,
				signal
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to transcribe audio');
			}

			const result = await response.json();
			const transcription = result.transcription;

			if (transcription) {
				value = (value ? value + '\n' : '') + transcription;
				onInput?.(value);
			}
		} catch (error: any) {
			if (error.name === 'AbortError') {
				console.log('Fetch aborted by user.');
				recordingError = m.transcription_cancelled_message();
			} else {
				console.error('Transcription error:', error);
				recordingError = m.transcription_failed_message({
					message: error.message || 'Unknown error'
				});
			}
		} finally {
			isTranscribing = false;
			abortController = null;
		}
	}

	function handleInput(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		value = target.value;
		onInput?.(value);
	}
</script>

<div class={className}>
	<fieldset class="fieldset rounded-box border border-base-300 bg-base-200 p-4">
		{#if legend}
			<legend class="fieldset-legend">{legend}</legend>
		{/if}

		<TextArea
			{name}
			{placeholder}
			{rows}
			bind:value
			oninput={handleInput}
			class="w-full rounded-md p-2 focus:ring-2 focus:ring-primary focus:outline-none"
		/>

		<div class="mt-2 flex items-center gap-2">
			<Button
				type="button"
				variant={isProcessing ? 'error' : 'primary'}
				size="sm"
				onclick={isProcessing ? stopRecording : startRecording}
			>
				{#if isRecording}
					<Icon name="stop" size="sm" />
					{m.stop_recording_button()}
				{:else if isTranscribing}
					<Icon name="stop" size="sm" />
					{m.cancel_transcription_button()}
				{:else}
					<Icon name="microphone" size="sm" />
					{m.record_audio_button()}
				{/if}
			</Button>

			<Select
				bind:value={selectedLanguage}
				options={languageOptions}
				size="sm"
				disabled={isProcessing}
				class="w-30"
			/>
		</div>
	</fieldset>

	{#if isTranscribing}
		<p class="mt-2 flex items-center gap-2 text-info">
			<Spinner size="sm" />
			{m.transcribing_audio_message()}
		</p>
	{/if}

	{#if recordingError}
		<div class="mt-2">
			<Alert variant="error" dismissible onDismiss={() => (recordingError = null)}>
				{recordingError}
			</Alert>
		</div>
	{/if}
</div>
