<script lang="ts">
	import RichTextInput from '$lib/client/components/RichTextInput.svelte';
	import StreamedAnalysisDisplay from '$lib/client/components/StreamedAnalysisDisplay.svelte';
	import * as m from '$lib/paraglide/messages';
	import { enhance } from '$app/forms';
	import type { DreamPromptType } from '$lib/prompts/dreamAnalyst';
	import { promptService } from '$lib/prompts/promptService';

	let {
		dreamId, // New prop for dream ID
		interpretation,
		tags,
		status,
		promptType, // This prop now represents the current promptType from the dream
		isLoadingStream = $bindable(),
		isDownloadingAudio = $bindable(), // New bindable prop for audio download state
		streamError,
		onRegenerateAnalysis, // This callback now expects a promptType argument
		onCancelAnalysis
	} = $props();

	let isEditingInterpretation = $state(false);
	let editedInterpretationText = $state(interpretation || '');
	let isSavingInterpretationEdit = $state(false);
	let interpretationEditError = $state<string | null>(null);

	// Local state for the selected prompt type in the dropdown
	let selectedPromptType: DreamPromptType = $state(promptType || 'jungian');
	const availablePromptTypes: DreamPromptType[] = promptService.getAvailablePromptTypes();

	let audioSrc = $state<string | null>(null); // State to hold the audio source URL
	let isPlayingAudio = $state(false); // State to track if audio is currently playing
	let audioElement: HTMLAudioElement | null = $state(null); // Reference to the audio element
	let audioAbortController: AbortController | null = $state(null); // To abort ongoing audio fetch

	// Store the interpretation text that was used to generate the current audioSrc
	let audioInterpretationText: string | null = $state(null);

	// Effect to update local selectedPromptType when the prop changes (e.g., after a successful regeneration)
	$effect(() => {
		editedInterpretationText = interpretation || '';
		selectedPromptType = promptType || 'jungian';
		// Reset audio when interpretation changes
		if (interpretation !== audioInterpretationText) {
			if (audioElement) {
				audioElement.pause();
				audioElement.removeAttribute('src'); // Clear the src
			}
			if (audioAbortController) {
				audioAbortController.abort(); // Abort any ongoing fetch
				audioAbortController = null;
			}
			// No need to revokeObjectURL if audioSrc is directly the API endpoint
			audioSrc = null;
			audioInterpretationText = null;
			isPlayingAudio = false;
		}
	});

	function toggleInterpretationEditMode() {
		isEditingInterpretation = !isEditingInterpretation;
		if (isEditingInterpretation) {
			editedInterpretationText = interpretation || '';
			interpretationEditError = null;
		}
	}

	function handleCancelInterpretationEdit() {
		isEditingInterpretation = false;
		editedInterpretationText = interpretation || '';
		interpretationEditError = null;
	}

	function handleInterpretationInput(value: string) {
		editedInterpretationText = value;
	}

	function handlePromptTypeChange(event: Event) {
		selectedPromptType = (event.target as HTMLSelectElement).value as DreamPromptType;
	}

	async function handleInterpretationSubmit({ update }) {
		isSavingInterpretationEdit = true;
		interpretationEditError = null;
		await update();
		isSavingInterpretationEdit = false;
		isEditingInterpretation = false; // Exit edit mode on success or failure
	}

	async function handleRegenerateSubmit({ update, result }) {
		await update(); // Update page data from server response
		if (result.type === 'success') {
			// Call the parent's onRegenerateAnalysis with the currently selected prompt type
			onRegenerateAnalysis(selectedPromptType);
		}
	}

	async function togglePlayAudio() {
		if (!interpretation) {
			alert('No interpretation available to convert to audio.');
			return;
		}

		if (!audioElement) {
			console.error('Audio element not found.');
			return;
		}

		if (isPlayingAudio) {
			audioElement.pause();
			isPlayingAudio = false;
			if (audioAbortController) {
				audioAbortController.abort(); // Abort ongoing fetch if paused
				audioAbortController = null;
			}
		} else {
			if (audioSrc && audioInterpretationText === interpretation) {
				// If audio is already loaded for the current interpretation, just play it
				try {
					await audioElement.play();
					isPlayingAudio = true;
				} catch (error) {
					if (error instanceof DOMException && error.name === 'AbortError') {
						console.warn('Audio play aborted (likely by user interaction or new load).');
					} else {
						console.error('Error playing audio:', error);
						alert(`Failed to play audio: ${(error as Error).message}`);
					}
					isPlayingAudio = false;
				}
			} else {
				// If audio not loaded or interpretation changed, fetch and play
				await fetchAndLoadAudio();
			}
		}
	}

	async function fetchAndLoadAudio() {
		if (!interpretation) {
			alert('No interpretation available to convert to audio.');
			return;
		}
		if (!audioElement) {
			console.error('Audio element not found for loading.');
			return;
		}

		// Abort any previous audio fetch
		if (audioAbortController) {
			audioAbortController.abort();
		}
		audioAbortController = new AbortController();
		const { signal } = audioAbortController;

		isDownloadingAudio = true; // Use this state for fetching/generating audio
		try {
			// Set the audio source directly to the API endpoint for streaming
			audioSrc = `/api/dreams/${dreamId}/tts`;
			audioInterpretationText = interpretation; // Mark which interpretation this audio is for

			audioElement.src = audioSrc; // Set the new source
			audioElement.load(); // Load the audio

			// Attempt to play the audio after loading
			try {
				await audioElement.play();
				isPlayingAudio = true;
			} catch (error) {
				if (error instanceof DOMException && error.name === 'AbortError') {
					console.warn('Audio play aborted (likely by user interaction or new load).');
				} else {
					console.error('Error playing audio after load:', error);
					alert(`Failed to play audio: ${(error as Error).message}`);
				}
				isPlayingAudio = false;
			}
		} catch (error) {
			console.error('Error fetching audio:', error);
			alert(`Failed to fetch audio: ${(error as Error).message}`);
		} finally {
			isDownloadingAudio = false;
			audioAbortController = null; // Clear controller after fetch attempt
		}
	}

	function handleAudioEnded() {
		isPlayingAudio = false;
		if (audioAbortController) {
			audioAbortController.abort(); // Abort ongoing fetch if playback ends
			audioAbortController = null;
		}
	}

	function handleDownloadAudio() {
		if (!interpretation) {
			alert('No interpretation available to download.');
			return;
		}
		// Trigger download by navigating to the API endpoint
		window.open(`/api/dreams/${dreamId}/tts?download=true`, '_blank'); // Add a query param to indicate download
	}
</script>

<div class="mb-6">
	<div class="mb-2 flex items-center justify-between">
		<h3 class="text-lg font-semibold">{m.interpretation_heading()}</h3>
		<div class="flex items-center gap-2">
			<div class="join-vertical join lg:join-horizontal">
				<!-- Prompt Type Selector -->
				<select
					class="select-bordered select join-item select-sm"
					bind:value={selectedPromptType}
					onchange={handlePromptTypeChange}
					disabled={isLoadingStream}
				>
					{#each availablePromptTypes as type}
						<option value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
					{/each}
				</select>

				{#if status === 'COMPLETED' || status === 'ANALYSIS_FAILED'}
					<form
						method="POST"
						action="?/resetAnalysis"
						use:enhance={() => {
							// Optimistically set loading state and clear previous data
							isLoadingStream = true;
							return handleRegenerateSubmit;
						}}
					>
						<!-- Hidden input to send selectedPromptType to the server action -->
						<input type="hidden" name="promptType" value={selectedPromptType} />
						<button
							type="submit"
							class="btn join-item btn-sm btn-primary"
							disabled={isLoadingStream}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="mr-1 h-4 w-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4 4v5h.582m15.356 2A8.001 8.001 0 004 12v1m6.707 3.293a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L13 14.586V11a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3z"
								/>
							</svg>
							{m.regenerate_analysis_button()}
						</button>
					</form>
				{:else if status === 'PENDING_ANALYSIS' && isLoadingStream}
					<button onclick={onCancelAnalysis} class="btn join-item btn-sm btn-warning">
						<span class="loading loading-spinner"></span>
						{m.cancel_analysis_button()}
					</button>
				{/if}
			</div>
			{#if !isEditingInterpretation}
				<button onclick={toggleInterpretationEditMode} class="btn btn-ghost btn-sm">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
						/>
					</svg>
					{m.edit_button()}
				</button>
			{/if}
		</div>
	</div>

	{#if isEditingInterpretation}
		<form
			method="POST"
			action="?/updateInterpretation"
			use:enhance={() => handleInterpretationSubmit}
		>
			<RichTextInput
				name="interpretation"
				placeholder={m.interpretation_heading()}
				rows={8}
				bind:value={editedInterpretationText}
				onInput={handleInterpretationInput}
			/>
			{#if interpretationEditError}
				<div class="mt-1 text-sm text-error">{interpretationEditError}</div>
			{/if}
			<div class="mt-2 flex justify-end gap-2">
				<button onclick={handleCancelInterpretationEdit} type="button" class="btn btn-ghost btn-sm"
					>{m.cancel_button()}</button
				>
				<button
					type="submit"
					class="btn btn-sm btn-primary"
					disabled={isSavingInterpretationEdit || editedInterpretationText.length < 10}
				>
					{#if isSavingInterpretationEdit}
						<span class="loading loading-spinner"></span>
						{m.save_button()}
					{:else}
						{m.save_button()}
					{/if}
				</button>
			</div>
		</form>
	{:else if status === 'PENDING_ANALYSIS' && !isLoadingStream && !streamError}
		<div class="alert alert-info shadow-lg">
			<div>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					class="h-6 w-6 shrink-0 stroke-current"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					></path></svg
				>
				<span>{m.analysis_pending_message()}</span>
			</div>
		</div>
	{:else if status === 'ANALYSIS_FAILED' && !isLoadingStream && !streamError}
		<div class="alert alert-error shadow-lg">
			<div>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6 flex-shrink-0 stroke-current"
					fill="none"
					viewBox="0 0 24 24"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
					></path></svg
				>
				<span>{m.ANALYSIS_FAILED_message()}</span>
			</div>
		</div>
		<button onclick={() => onRegenerateAnalysis(selectedPromptType)} class="btn mt-4 btn-primary"
			>{m.retry_analysis_button()}</button
		>
	{:else if !interpretation && !tags.length && !isLoadingStream && !streamError}
		<p>{m.no_interpretation_available_message()}</p>
	{/if}

	{#if interpretation || tags.length > 0 || isLoadingStream || streamError}
		<StreamedAnalysisDisplay
			{interpretation}
			{tags}
			isLoading={isLoadingStream}
			errorMessage={streamError}
			{status}
		/>
	{/if}

	{#if interpretation && status === 'COMPLETED'}
		<div class="mt-4 flex justify-end gap-2">
			<button
				class="btn btn-sm btn-outline"
				onclick={togglePlayAudio}
				disabled={isDownloadingAudio}
			>
				{#if isDownloadingAudio}
					<span class="loading loading-spinner"></span>
					Loading Audio...
				{:else if isPlayingAudio}
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 mr-1">
						<path stroke-linecap="round" stroke-linejoin="round" d="M14.25 9v6m-4.5 0V9M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
					</svg>
					Pause Audio
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 mr-1">
						<path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
						<path stroke-linecap="round" stroke-linejoin="round" d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.328l5.603 3.113Z" />
					</svg>
					Play Audio
				{/if}
			</button>
			<button
				class="btn btn-sm btn-primary"
				onclick={handleDownloadAudio}
				disabled={isDownloadingAudio}
			>
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 mr-1">
					<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
				</svg>
				Download Audio
			</button>
		</div>
		<audio bind:this={audioElement} src={audioSrc || ''} onended={handleAudioEnded} preload="none"></audio>
	{/if}
</div>
