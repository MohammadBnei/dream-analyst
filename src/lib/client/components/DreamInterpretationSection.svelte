<script lang="ts">
	import RichTextInput from '$lib/client/components/RichTextInput.svelte';
	import StreamedAnalysisDisplay from '$lib/client/components/StreamedAnalysisDisplay.svelte';
	import * as m from '$lib/paraglide/messages';
	import { enhance } from '$app/forms';
	import type { DreamPromptType } from '$lib/prompts/dreamAnalyst';
	import { promptService } from '$lib/prompts/promptService';

	let {
		interpretation,
		tags,
		status,
		promptType,
		isLoadingStream,
		streamError,
		onRegenerateAnalysis,
		onCancelAnalysis
	} = $props();

	let isEditingInterpretation = $state(false);
	let editedInterpretationText = $state(interpretation || '');
	let isSavingInterpretationEdit = $state(false);
	let interpretationEditError = $state<string | null>(null);

	let selectedPromptType: DreamPromptType = $state(promptType || 'jungian');
	const availablePromptTypes: DreamPromptType[] = promptService.getAvailablePromptTypes();

	$effect(() => {
		editedInterpretationText = interpretation || '';
		selectedPromptType = promptType || 'jungian';
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
			onRegenerateAnalysis(selectedPromptType); // Start the stream if reset was successful
		}
	}

</script>

<div class="mb-6">
	<div class="mb-2 flex items-center justify-between">
		<h3 class="text-lg font-semibold">{m.interpretation_heading()}</h3>
		<div class="flex items-center gap-2">
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
			<!-- Prompt Type Selector -->
			<select
				class="select-bordered select select-sm"
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
					<button type="submit" class="btn btn-sm btn-primary" disabled={isLoadingStream}>
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
				<button onclick={onCancelAnalysis} class="btn btn-sm btn-warning">
					<span class="loading loading-spinner"></span>
					{m.cancel_analysis_button()}
				</button>
			{/if}
		</div>
	</div>

	{#if isEditingInterpretation}
		<form method="POST" action="?/updateInterpretation" use:enhance={handleInterpretationSubmit}>
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
</div>
