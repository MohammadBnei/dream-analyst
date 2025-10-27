<script lang="ts">
	import { enhance } from '$app/forms';
	import { fade } from 'svelte/transition';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	let dreamText: string = '';
	let isSaving: boolean = false;
	let isAnalyzing: boolean = false;
	let currentDreamId: string | null = null;
	let streamedInterpretation: string = '';
	let streamedTags: string[] = [];
	let errorMessage: string | null = null;

	$: isSaveDisabled = dreamText.length < 10 || isSaving || isAnalyzing;

	function resetForm() {
		dreamText = '';
		isSaving = false;
		isAnalyzing = false;
		currentDreamId = null;
		streamedInterpretation = '';
		streamedTags = [];
		errorMessage = null;
	}

	async function startStreamingAnalysis(dreamId: string) {
		isAnalyzing = true;
		streamedInterpretation = '';
		streamedTags = [];
		errorMessage = null;

		const eventSource = new EventSource(`/api/dreams/${dreamId}/stream-analysis`);

		eventSource.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				if (data.interpretation) {
					streamedInterpretation += data.interpretation;
				}
				if (data.tags) {
					streamedTags = data.tags; // Tags might come as a complete array at the end
				}
			} catch (e) {
				console.error('Error parsing SSE data:', e, event.data);
			}
		};

		eventSource.onerror = (event) => {
			console.error('EventSource failed:', event);
			errorMessage = 'Analysis stream failed. Please try again.';
			isAnalyzing = false;
			eventSource.close();
		};

		eventSource.onopen = () => {
			console.log('EventSource connected.');
		};

		eventSource.addEventListener('end', (event) => {
			console.log('Analysis stream ended.');
			isAnalyzing = false;
			eventSource.close();
			// Optionally, dispatch an event or show a toast for completion
			dispatch('dreamAnalysisCompleted', { dreamId, interpretation: streamedInterpretation, tags: streamedTags });
		});

		eventSource.addEventListener('error', (event) => {
			console.error('Analysis stream error:', event);
			errorMessage = 'Analysis stream encountered an error.';
			isAnalyzing = false;
			eventSource.close();
		});
	}

	const submitForm = async ({ form, data, action, cancel }) => {
		isSaving = true;
		errorMessage = null;
		currentDreamId = null;
		streamedInterpretation = '';
		streamedTags = [];

		return async ({ result, update }) => {
			if (result.type === 'success') {
				currentDreamId = result.data?.dreamId;
				if (currentDreamId) {
					await startStreamingAnalysis(currentDreamId);
				} else {
					errorMessage = 'Dream saved, but no ID received to start analysis.';
					isSaving = false;
				}
			} else if (result.type === 'error') {
				errorMessage = result.error?.message || 'An unknown error occurred.';
				isSaving = false;
			} else if (result.type === 'failure') {
				errorMessage = result.data?.message || 'Failed to save dream.';
				isSaving = false;
			}
			isSaving = false; // Saving is done, now analysis starts
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
				{:else if isAnalyzing}
					<span class="loading loading-spinner"></span>
					Analyzing...
				{:else}
					Save Dream
				{/if}
			</button>
		</div>

		{#if !isSaving && !isAnalyzing && !streamedInterpretation && !errorMessage}
			<p class="text-center text-sm text-base-content/70 mt-4">
				Your dream will be analyzed instantly – please wait a few seconds.
			</p>
		{/if}
	</form>

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

	{#if streamedInterpretation || streamedTags.length > 0}
		<div class="mt-8 p-6 bg-base-200 rounded-box shadow-lg" transition:fade>
			<h2 class="text-2xl font-semibold mb-4">Dream Analysis</h2>

			{#if streamedTags.length > 0}
				<div class="mb-4">
					<h3 class="text-lg font-medium mb-2">Tags:</h3>
					<div class="flex flex-wrap gap-2">
						{#each streamedTags as tag}
							<span class="badge badge-primary badge-lg">{tag}</span>
						{/each}
					</div>
				</div>
			{/if}

			{#if streamedInterpretation}
				<div class="mb-4">
					<h3 class="text-lg font-medium mb-2">Interpretation:</h3>
					<div class="prose max-w-none">
						<p>{streamedInterpretation}</p>
					</div>
				</div>
			{/if}

			<div class="flex justify-end mt-6">
				<button class="btn btn-secondary" on:click={resetForm}>Add Another Dream</button>
			</div>
		</div>
	{/if}
</div>
