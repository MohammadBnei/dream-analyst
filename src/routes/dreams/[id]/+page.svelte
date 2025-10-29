<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { onDestroy } from 'svelte';
	import * as m from '$lib/paraglide/messages';
	import { DreamAnalysisService } from '$lib/client/services/dreamAnalysisService';
	import { invalidate } from '$app/navigation';
	import StreamedAnalysisDisplay from '$lib/client/components/StreamedAnalysisDisplay.svelte';

	let { data }: PageData = $props();

	let dream = $derived(data.dream);

	let streamedInterpretation = $state(dream.interpretation || '');
	let streamedTags = $state(dream.tags || []);
	let currentDreamStatus = $state(dream.status);

	let isLoadingStream = $state(false);
	let streamError = $state<string | null>(null);

	let showDeleteModal = $state(false);
	let isDeleting = $state(false);
	let deleteError = $state<string | null>(null);

	let analysisService: DreamAnalysisService | null = null;

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
		analysisService?.closeStream();
	});

	// Effect to update local state when the 'dream' object changes (e.g., after invalidate)
	$effect(() => {
		if (dream) {
			streamedInterpretation = dream.interpretation || '';
			streamedTags = dream.tags || [];
			currentDreamStatus = dream.status;
			// Reset stream-related states if dream is no longer pending
			if (dream.status !== 'pending_analysis') {
				isLoadingStream = false;
				streamError = null;
			}
		}
	});

	function startStream() {
		isLoadingStream = true;
		streamError = null;
		// Do not clear streamedInterpretation/Tags here if we want to show initial state from Redis
		// streamedInterpretation = '';
		// streamedTags = [];
		currentDreamStatus = 'pending_analysis'; // Optimistic update for UI

		analysisService = new DreamAnalysisService(dream.id, {
			onMessage: (data) => {
				isLoadingStream = false; // Once we receive a message, we're no longer just "loading" the stream connection
				if (data.content) {
					streamedInterpretation += data.content;
				}
				if (data.tags) {
					streamedTags = data.tags;
				}
				if (data.status) {
					currentDreamStatus = data.status as App.Dream['status'];
				}
			},
			onEnd: async (data) => {
				console.log('Stream ended:', data);
				isLoadingStream = false;
				// Invalidate the page data to re-fetch the dream's final status and interpretation from the server
				await invalidate('dreams:id'); // <--- This is crucial for getting the final persisted status
				// The currentDreamStatus will be updated by the $effect reacting to the new 'dream' data.
			},
			onError: (errorMsg) => {
				console.error('Stream error:', errorMsg);
				isLoadingStream = false;
				currentDreamStatus = 'analysis_failed'; // Optimistic update, will be confirmed by invalidate
				streamError = errorMsg;
			},
			onClose: () => {
				console.log('Analysis service stream closed.');
			}
		});
		analysisService.startStream();
	}

	async function regenerateAnalysis() {
		analysisService?.closeStream(); // Close any existing stream
		streamedInterpretation = ''; // Clear current interpretation
		streamedTags = [];
		streamError = null; // Clear any previous error
		currentDreamStatus = 'pending_analysis'; // Reset status immediately for UI feedback
		isLoadingStream = true;

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

	async function handleManualStatusChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		const newStatus = target.value;

		if (!dream || !newStatus) return;

		try {
			const response = await fetch(`/api/dreams/${dream.id}/update-status`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ status: newStatus })
			});

			if (response.ok) {
				currentDreamStatus = newStatus as App.Dream['status'];
				// Invalidate to ensure the server-side data is consistent
				await invalidate('dreams:id');
				console.log('Dream status updated successfully!');
			} else {
				const errorData = await response.json();
				alert(`Failed to update dream status: ${errorData.message || response.statusText}`);
				// Revert dropdown if update failed
				target.value = dream.status; // Revert to original status
			}
		} catch (error) {
			console.error('Error updating dream status:', error);
			alert(`Error updating dream status: ${(error as Error).message}`);
			// Revert dropdown if update failed
			target.value = dream.status; // Revert to original status
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
				<div class="flex items-center gap-2">
					<span class="badge {getStatusBadgeClass(currentDreamStatus)}"
						>{currentDreamStatus.replace('_', ' ')}</span
					>
					{#if currentDreamStatus === 'pending_analysis'}
						<select class="select select-bordered select-sm" onchange={handleManualStatusChange}>
							<option value="" disabled selected>{m.change_status_option()}</option>
							<option value="analysis_failed">{m.reset_to_failed_analysis_option()}</option>
						</select>
					{/if}
				</div>
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

				{#if currentDreamStatus === 'pending_analysis' && !isLoadingStream && !streamError}
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
				{:else if currentDreamStatus === 'analysis_failed' && !isLoadingStream && !streamError}
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
					<button onclick={startStream} class="btn mt-4 btn-primary">{m.retry_analysis_button()}</button>
				{:else if !streamedInterpretation && !streamedTags.length && !isLoadingStream && !streamError}
					<p>{m.no_interpretation_available_message()}</p>
				{/if}

				{#if streamedInterpretation || streamedTags.length > 0 || isLoadingStream || streamError}
					<StreamedAnalysisDisplay
						interpretation={streamedInterpretation}
						tags={streamedTags}
						isLoading={isLoadingStream}
						errorMessage={streamError}
						status={currentDreamStatus}
					/>
				{/if}
			</div>

			<div class="mt-6 text-sm text-base-content/60">
				<p>{m.created_at_label({ date: new Date(dream.createdAt).toLocaleString() })}</p>
				<p>{m.last_updated_at_label({ date: new Date(dream.updatedAt).toLocaleString() })}</p>
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
					<button class="btn btn-ghost" onclick={handleCancelDelete} disabled={isDeleting}
						>{m.cancel_button()}</button
					>
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
</div>

<style lang="postcss">
	/* The prose class from @tailwindcss/typography will handle most markdown styling. */
	/* You can add custom styles here if needed, but generally, Streamdown handles its own styling */
	/* or relies on the prose class. */
</style>
