<script lang="ts">
	import type { PageProps } from './$types';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { Streamdown } from 'svelte-streamdown'; // Import Streamdown

	let { data }: PageProps = $props();

	let dream = $derived(data.dream);

	let streamedInterpretation = $state(dream.interpretation || '');
	let currentDreamStatus = $state(dream.status);

	let isLoadingStream = $state(false);
	let streamError = $state<string | null>(null);
	let eventSource = $state<EventSource | null>(null);

	let showDeleteModal = $state(false);
	let isDeleting = $state(false);
	let deleteError = $state<string | null>(null);

	// Function to determine badge color based on dream status
	function getStatusBadgeClass(status: App.Dream['status']) {
		switch (status) {
			case 'completed':
				return 'badge-success';
			case 'pending_analysis':
				return 'badge-info';
			case 'analysis_failed':
				return 'badge-error';
			default:
				return 'badge-neutral';
		}
	}

	onMount(() => {
		// If the dream is pending analysis, start the stream immediately
		if (currentDreamStatus === 'pending_analysis') {
			startStream();
		} else if (currentDreamStatus === 'completed' && dream.interpretation) {
			// If already completed, display the stored interpretation
			streamedInterpretation = dream.interpretation;
		}
	});

	onDestroy(() => {
		if (eventSource) {
			eventSource.close();
			console.log('EventSource closed.');
		}
	});

	async function startStream() {
		isLoadingStream = true;
		streamError = null;
		streamedInterpretation = ''; // Clear previous interpretation for a new stream
		currentDreamStatus = 'pending_analysis';

		eventSource = new EventSource(`/api/dreams/${dream.id}/stream-analysis`);

		eventSource.onopen = () => {
			console.log('EventSource opened.');
		};

		eventSource.onmessage = (event) => {
			isLoadingStream = false; // Once we receive a message, we're no longer just "loading" the stream connection
			try {
				const data = JSON.parse(event.data);
				if (data.content) {
					streamedInterpretation += data.content;
				}
			} catch (e) {
				console.error('Error parsing SSE message:', e, event.data);
			}
		};

		eventSource.addEventListener('end', (event) => {
			console.log('Stream ended:', event.data);
			isLoadingStream = false;
			currentDreamStatus = 'completed'; // Assume completed on 'end' event
			if (eventSource) {
				eventSource.close();
			}
		});

		eventSource.addEventListener('error', (event) => {
			console.error('EventSource error:', event);
			isLoadingStream = false;
			currentDreamStatus = 'analysis_failed';
			streamError = 'Failed to load dream analysis. Please try again.';
			if (eventSource) {
				eventSource.close();
			}
		});
	}

	async function regenerateAnalysis() {
		if (eventSource) {
			eventSource.close(); // Close any existing stream
		}
		streamedInterpretation = ''; // Clear current interpretation
		streamError = null; // Clear any previous error
		currentDreamStatus = 'pending_analysis'; // Reset status immediately for UI feedback

		try {
			// First, call an API to reset the dream status to 'pending_analysis'
			const response = await fetch(`/api/dreams/${dream.id}/reset-status`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				const errData = await response.json();
				throw new Error(errData.message || 'Failed to reset dream status.');
			}

			// If status reset is successful, then start the stream
			startStream();
		} catch (e) {
			console.error('Error regenerating analysis:', e);
			streamError =
				e instanceof Error ? e.message : 'An unknown error occurred during regeneration.';
			currentDreamStatus = 'analysis_failed'; // Set status back to failed if reset fails
			isLoadingStream = false;
		}
	}

	async function deleteDream() {
		isDeleting = true;
		deleteError = null;
		try {
			const response = await fetch(`/api/dreams/${dream.id}/delete`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const errData = await response.json();
				throw new Error(errData.message || 'Failed to delete dream.');
			}

			await goto('/dreams'); // Redirect to the dreams list page after successful deletion
		} catch (e) {
			console.error('Error deleting dream:', e);
			deleteError = e instanceof Error ? e.message : 'An unknown error occurred during deletion.';
		} finally {
			isDeleting = false;
			showDeleteModal = false; // Close modal regardless of success/failure
		}
	}
</script>

<div class="container mx-auto max-w-4xl p-4">
	<div class="mb-6 flex items-center justify-between">
		<button onclick={() => goto('/dreams')} class="btn btn-ghost">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-5 w-5"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
			Back to Dreams
		</button>
		<h1 class="grow text-center text-3xl font-bold">Dream Details</h1>
		<div class="w-24 text-right">
			<button onclick={() => (showDeleteModal = true)} class="btn btn-error btn-sm">
				Delete Dream
			</button>
		</div>
	</div>

	<div class="card bg-base-100 p-6 shadow-xl">
		<div class="card-body p-0">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="card-title text-2xl">
					Dream on {new Date(dream.createdAt).toLocaleDateString()}
				</h2>
				<span class="badge {getStatusBadgeClass(currentDreamStatus)}"
					>{currentDreamStatus.replace('_', ' ')}</span
				>
			</div>

			<div class="mb-6">
				<h3 class="mb-2 text-lg font-semibold">Raw Dream Text:</h3>
				<p class="leading-relaxed whitespace-pre-wrap text-base-content/80">
					{dream.rawText}
				</p>
			</div>

			<div class="mb-6">
				<div class="mb-2 flex items-center justify-between">
					<h3 class="text-lg font-semibold">Interpretation:</h3>
					{#if currentDreamStatus === 'completed' || currentDreamStatus === 'analysis_failed'}
						<button
							onclick={regenerateAnalysis}
							class="btn btn-sm btn-primary"
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
							Regenerate Analysis
						</button>
					{/if}
				</div>

				{#if isLoadingStream}
					<div class="alert alert-info shadow-lg">
						<div>
							<svg class="mr-3 h-5 w-5 animate-spin" viewBox="0 0 24 24">
								<circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								></circle>
								<path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								></path>
							</svg>
							<span>Analyzing your dream...</span>
						</div>
					</div>
				{:else if streamError}
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
							<span>{streamError}</span>
						</div>
					</div>
					<button onclick={startStream} class="btn mt-4 btn-primary">Retry Analysis</button>
				{:else if streamedInterpretation}
					<div class="prose max-w-none">
						<Streamdown content={streamedInterpretation} />
					</div>
				{:else if currentDreamStatus === 'pending_analysis'}
					<div class="alert alert-info shadow-lg">
						<div>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								class="h-6 w-6 flex-shrink-0 stroke-current"
								><path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								></path></svg
							>
							<span>Analysis pending... Please check back later or refresh.</span>
						</div>
					</div>
				{:else if currentDreamStatus === 'analysis_failed'}
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
							<span>Analysis failed. We could not process your dream.</span>
						</div>
					</div>
				{:else}
					<p>No interpretation available.</p>
				{/if}
			</div>

			<div class="mt-6 text-sm text-base-content/60">
				<p>Created: {new Date(dream.createdAt).toLocaleString()}</p>
				<p>Last Updated: {new Date(dream.updatedAt).toLocaleString()}</p>
			</div>
		</div>
	</div>
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteModal}
	<dialog open class="modal modal-bottom sm:modal-middle" on:click|self={() => (showDeleteModal = false)}>
		<div class="modal-box">
			<h3 class="font-bold text-lg">Confirm Deletion</h3>
			<p class="py-4">Are you sure you want to delete this dream? This action cannot be undone.</p>
			{#if deleteError}
				<div class="alert alert-error shadow-lg mb-4">
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
						<span>{deleteError}</span>
					</div>
				</div>
			{/if}
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={() => (showDeleteModal = false)} disabled={isDeleting}>Cancel</button>
				<button class="btn btn-error" onclick={deleteDream} disabled={isDeleting}>
					{#if isDeleting}
						<span class="loading loading-spinner"></span>
						Deleting...
					{:else}
						Delete
					{/if}
				</button>
			</div>
		</div>
	</dialog>
{/if}

<style lang="postcss">
	/* The prose class from @tailwindcss/typography will handle most markdown styling. */
	/* You can add custom styles here if needed, but generally, Streamdown handles its own styling */
	/* or relies on the prose class. */
</style>
