<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { fade } from 'svelte/transition';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	let dreamText: string = '';
	let isSaving: boolean = false;
	let analysisResult: App.Dream | null = null;
	let errorMessage: string | null = null;

	$: isSaveDisabled = dreamText.length < 10 || isSaving;

	function resetForm() {
		dreamText = '';
		analysisResult = null;
		errorMessage = null;
		isSaving = false;
	}

	// Function to handle the form submission and update UI based on response
	const submitForm = async ({ form, data, action, cancel }) => {
		isSaving = true;
		errorMessage = null;
		analysisResult = null;

		return async ({ result, update }) => {
			if (result.type === 'success') {
				analysisResult = result.data?.dream;
				// Optionally, dispatch an event or show a toast for success
				dispatch('dreamSaved', analysisResult);
			} else if (result.type === 'error') {
				errorMessage = result.error?.message || 'An unknown error occurred.';
			} else if (result.type === 'failure') {
				errorMessage = result.data?.message || 'Failed to save dream.';
			}
			isSaving = false;
			update(); // Update the page with the new data
		};
	};
</script>

<div class="container mx-auto p-4 max-w-2xl">
	<h1 class="text-3xl font-bold mb-6 text-center">New Dream</h1>

	<form method="POST" use:enhance={submitForm} class="space-y-6">
		<div class="form-control">
			<label for="dreamText" class="label">
				<span class="label-text">What did you dream?</span>
			</label>
			<textarea
				id="dreamText"
				name="dreamText"
				class="textarea textarea-bordered h-48 w-full"
				placeholder="Describe your dream here..."
				bind:value={dreamText}
				required
				minlength="10"
			></textarea>
			<label class="label">
				<span class="label-text-alt">Minimum 10 characters</span>
			</label>
		</div>

		<div class="flex justify-center">
			<button type="submit" class="btn btn-primary btn-lg" disabled={isSaveDisabled}>
				{#if isSaving}
					<span class="loading loading-spinner"></span>
					Saving...
				{:else}
					Save Dream
				{/if}
			</button>
		</div>

		{#if !isSaving && !analysisResult && !errorMessage}
			<p class="text-center text-sm text-base-content/70 mt-4">
				Your dream will be analyzed instantly – please wait a few seconds.
			</p>
		{/if}
	</form>

	{#if isSaving}
		<div class="flex flex-col items-center mt-8" transition:fade>
			<span class="loading loading-dots loading-lg text-primary"></span>
			<p class="mt-4 text-lg">Analyzing your dream...</p>
		</div>
	{/if}

	{#if errorMessage}
		<div role="alert" class="alert alert-error mt-8" transition:fade>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="stroke-current shrink-0 h-6 w-6"
				fill="none"
				viewBox="0 0 24 24"
				><path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
				></path></svg
			>
			<span>Error: {errorMessage}</span>
			<button class="btn btn-sm btn-ghost" on:click={resetForm}>Retry</button>
		</div>
	{/if}

	{#if analysisResult}
		<div class="mt-8 p-6 bg-base-200 rounded-box shadow-lg" transition:fade>
			<h2 class="text-2xl font-semibold mb-4">Dream Analysis</h2>

			{#if analysisResult.tags && analysisResult.tags.length > 0}
				<div class="mb-4">
					<h3 class="text-lg font-medium mb-2">Tags:</h3>
					<div class="flex flex-wrap gap-2">
						{#each analysisResult.tags as tag}
							<span class="badge badge-primary badge-lg">{tag}</span>
						{/each}
					</div>
				</div>
			{/if}

			{#if analysisResult.interpretation}
				<div class="mb-4">
					<h3 class="text-lg font-medium mb-2">Interpretation:</h3>
					<div class="prose max-w-none">
						<p>{analysisResult.interpretation}</p>
					</div>
				</div>
			{/if}

			<div class="flex justify-end mt-6">
				<button class="btn btn-secondary" on:click={resetForm}>Add Another Dream</button>
			</div>
		</div>
	{/if}
</div>
