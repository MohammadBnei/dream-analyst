<script lang="ts">
	import type { PageProps } from './$types';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { Streamdown } from 'svelte-streamdown'; // Import Streamdown
	import * as m from '$lib/paraglide/messages';

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
			streamError = m.dream_analysis_failed_error();
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
				throw new Error(errData.message || m.reset_dream_status_failed_error());
			}

			// If status reset is successful, then start the stream
			startStream();
		} catch (e) {
			console.error('Error regenerating analysis:', e);
			streamError =
				e instanceof Error ? e.message : m.unknown_error_regenerating_analysis();
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
				throw new Error(errData.message || m.delete_dream_failed_error());
			}

			await goto('/dreams'); // Redirect to the dreams list page after successful deletion
		} catch (e) {
			console.error('Error deleting dream:', e);
			deleteError = e instanceof Error ? e.message : m.unknown_error_deleting_dream();
		} finally {
			isDeleting = false;
			showDeleteModal = false; // Close modal regardless of success/failure
		}
	}

	function handleBackClick() {
		goto('/dreams');
	}

	function handleShowDeleteModal() {
		showDeleteModal = true;
	}

	function handleCancelDelete() {
		showDeleteModal = false;
	}

	function handleModalSelfClick() {
		showDeleteModal = false;
	}
</script>

<div class="container mx-auto max-w-4xl p-4">
	<div class="mb-6 flex items-center justify-between">
		<button onclick={handleBackClick} class="btn btn-ghost">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-5 w-5"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
			{m.back_to_dreams_button()}
		</button>
		<h1 class="grow text-center text-3xl font-bold">{m.dream_details_title()}</h1>
		<div class="w-24 text-right">
			<button onclick={handleShowDeleteModal} class="btn btn-error btn-sm">
				{m.delete_dream_button()}
			</button>
		</div>
	</div>

	<div class="card bg-base-100 p-6 shadow-xl">
		<div class="card-body p-0">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="card-title text-2xl">
					{m.dream_on_date({ date: new Date(dream.createdAt).toLocaleDateString() })}
				</h2>
				<span class="badge {getStatusBadgeClass(currentDreamStatus)}"
					>{currentDreamStatus.replace('_', ' ')}</span
				>
			</div>

			<div class="mb-6">
				<h3 class="mb-2 text-lg font-semibold">{m.raw_dream_text_heading()}</h3>
				<p class="leading-relaxed whitespace-pre-wrap text-base-content/80">
					{dream.rawText}
				</p>
			</div>

			<div class="mb-6">
				<div class="mb-2 flex items-center justify-between">
					<h3 class="text-lg font-semibold">{m.interpretation_heading()}</h3>
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
							{m.regenerate_analysis_button()}
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
							<span>{m.analyzing_dream_message()}</span>
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
					<button onclick={startStream} class="btn mt-4 btn-primary">{m.retry_analysis_button()}</button>
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
							<span>{m.analysis_pending_message()}</span>
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
							<span>{m.analysis_failed_message()}</span>
						</div>
					</div>
				{:else}
					<p>{m.no_interpretation_available_message()}</p>
				{/if}
			</div>

			<div class="mt-6 text-sm text-base-content/60">
				<p>{m.created_at_label({ date: new Date(dream.createdAt).toLocaleString() })}</p>
				<p>{m.last_updated_at_label({ date: new Date(dream.updatedAt).toLocaleString() })}</p>
			</div>
		</div>
	</div>
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteModal}
	<dialog open class="modal modal-bottom sm:modal-middle" onclick={handleModalSelfClick}>
		<div class="modal-box">
			<h3 class="font-bold text-lg">{m.confirm_deletion_title()}</h3>
			<p class="py-4">{m.confirm_deletion_message()}</p>
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
				<button class="btn btn-ghost" onclick={handleCancelDelete} disabled={isDeleting}>{m.cancel_button()}</button>
				<button class="btn btn-error" onclick={deleteDream} disabled={isDeleting}>
					{#if isDeleting}
						<span class="loading loading-spinner"></span>
						{m.deleting_button()}
					{:else}
						{m.delete_button()}
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
