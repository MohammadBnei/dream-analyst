<script lang="ts">
	import { goto } from '$app/navigation';
	import { onDestroy } from 'svelte';
	import * as m from '$lib/paraglide/messages';
	import { DreamAnalysisService } from '$lib/client/services/dreamAnalysisService';
	import StreamedAnalysisDisplay from '$lib/client/components/StreamedAnalysisDisplay.svelte';
	import { getDream, deleteDream, updateDreamStatus, resetDreamStatus, updateDream, updateDreamInterpretation } from '$lib/remote/dream.remote';

	let { params } = $props();
	const dreamId = params.id;

	// Fetch dream using the remote query
	const dreamQuery = getDream(dreamId);
	let dream = $derived(dreamQuery.current);

	let streamedInterpretation = $state(dream?.interpretation || '');
	let streamedTags = $state(dream?.tags || []);
	let currentDreamStatus = $state(dream?.status);

	let isLoadingStream = $state(false);
	let streamError = $state<string | null>(null);

	let showDeleteModal = $state(false);
	let isDeleting = $state(false);
	let deleteError = $state<string | null>(null);

	let isEditing = $state(false);
	let editedRawText = $state(dream?.rawText || '');
	let isSavingEdit = $state(false);
	let editError = $state<string | null>(null);

	let isEditingInterpretation = $state(false);
	let editedInterpretationText = $state(dream?.interpretation || '');
	let isSavingInterpretationEdit = $state(false);
	let interpretationEditError = $state<string | null>(null);

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
			editedRawText = dream.rawText; // Update edited text when dream data changes
			editedInterpretationText = dream.interpretation || ''; // Update edited interpretation text
			// Reset stream-related states if dream is no longer pending
			if (dream.status !== 'pending_analysis') {
				isLoadingStream = false;
				streamError = null;
			}
		}
	});

	// Effect to start stream when component mounts if dream is pending analysis
	$effect(() => {
		if ($effect.tracking() && dream && dream.status === 'pending_analysis') {
			console.log('Dream is pending analysis on mount, attempting to start stream...');
			startStream();
		}
	});

	function startStream() {
		if (!dream?.id) {
			console.warn('Cannot start stream: dream ID is not available.');
			return;
		}

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
				await dreamQuery.refresh(); // <--- This is crucial for getting the final persisted status
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
		if (!dream?.id) return;

		analysisService?.closeStream(); // Close any existing stream
		streamedInterpretation = ''; // Clear current interpretation
		streamedTags = [];
		streamError = null; // Clear any previous error
		currentDreamStatus = 'pending_analysis'; // Reset status immediately for UI feedback
		isLoadingStream = true;

		try {
			// Call the remote function to reset the dream status
			await resetDreamStatus(dream.id);
			await dreamQuery.refresh(); // Refresh to get the updated dream object
			startStream(); // Then start the stream
		} catch (e) {
			console.error('Error regenerating analysis:', e);
			streamError =
				e instanceof Error ? e.message : m.unknown_error_regenerating_analysis();
			currentDreamStatus = 'analysis_failed'; // Set status back to failed if reset fails
			isLoadingStream = false;
		}
	}

	async function handleDeleteDream() {
		if (!dream?.id) return;

		isDeleting = true;
		deleteError = null;
		try {
			await deleteDream(dream.id);
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
			await updateDreamStatus({ dreamId: dream.id, status: newStatus as App.Dream['status'] });
			currentDreamStatus = newStatus as App.Dream['status'];
			await dreamQuery.refresh(); // Refresh to ensure the server-side data is consistent
			console.log('Dream status updated successfully!');
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

	function toggleEditMode() {
		isEditing = !isEditing;
		if (isEditing) {
			editedRawText = dream?.rawText || ''; // Initialize with current rawText
			editError = null; // Clear any previous edit errors
		}
	}

	async function handleSaveEdit() {
		if (!dream?.id || editedRawText.length < 10) {
			editError = m.dream_text_too_short_error();
			return;
		}

		isSavingEdit = true;
		editError = null;
		try {
			await updateDream({ dreamId: dream.id, rawText: editedRawText });
			await dreamQuery.refresh(); // Refresh to get the updated dream object
			isEditing = false; // Exit edit mode
			console.log('Dream raw text updated successfully!');
		} catch (e) {
			console.error('Error saving dream edit:', e);
			editError = e instanceof Error ? e.message : m.unknown_error_saving_dream();
		} finally {
			isSavingEdit = false;
		}
	}

	function handleCancelEdit() {
		isEditing = false;
		editedRawText = dream?.rawText || ''; // Revert to original text
		editError = null;
	}

	function toggleInterpretationEditMode() {
		isEditingInterpretation = !isEditingInterpretation;
		if (isEditingInterpretation) {
			editedInterpretationText = dream?.interpretation || ''; // Initialize with current interpretation
			interpretationEditError = null; // Clear any previous edit errors
		}
	}

	async function handleSaveInterpretationEdit() {
		if (!dream?.id || editedInterpretationText.length < 10) {
			interpretationEditError = m.interpretation_text_too_short_error(); // New translation key needed
			return;
		}

		isSavingInterpretationEdit = true;
		interpretationEditError = null;
		try {
			await updateDreamInterpretation({ dreamId: dream.id, interpretation: editedInterpretationText });
			await dreamQuery.refresh(); // Refresh to get the updated dream object
			isEditingInterpretation = false; // Exit edit mode
			console.log('Dream interpretation updated successfully!');
		} catch (e) {
			console.error('Error saving interpretation edit:', e);
			interpretationEditError = e instanceof Error ? e.message : m.unknown_error_saving_interpretation(); // New translation key needed
		} finally {
			isSavingInterpretationEdit = false;
		}
	}

	function handleCancelInterpretationEdit() {
		isEditingInterpretation = false;
		editedInterpretationText = dream?.interpretation || ''; // Revert to original text
		interpretationEditError = null;
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

	{#if dreamQuery.loading}
		<div class="flex justify-center items-center h-64">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if dreamQuery.error}
		<div role="alert" class="alert alert-error">
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
			<span>Error loading dream: {dreamQuery.error.message}</span>
			<button class="btn btn-sm btn-ghost" onclick={() => dreamQuery.refresh()}>Retry</button>
		</div>
	{:else if dream}
		<div class="card bg-base-100 p-6 shadow-xl">
			<div class="card-body p-0">
				<div class="mb-4 flex items-center justify-between">
					<h2 class="card-title text-2xl">
						{m.dream_on_date({ date: new Date(dream.createdAt).toLocaleDateString() })}
					</h2>
					<div class="flex items-center gap-2">
						<span class="badge {getStatusBadgeClass(currentDreamStatus)}"
							>{currentDreamStatus?.replace('_', ' ')}</span
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
					<div class="flex items-center justify-between mb-2">
						<h3 class="text-lg font-semibold">{m.raw_dream_text_heading()}</h3>
						{#if !isEditing}
							<button onclick={toggleEditMode} class="btn btn-sm btn-ghost">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
								</svg>
								{m.edit_button()}
							</button>
						{/if}
					</div>
					{#if isEditing}
						<textarea
							class="input textarea textarea-bordered w-full h-48"
							bind:value={editedRawText}
							minlength="10"
						></textarea>
						{#if editError}
							<div class="text-error text-sm mt-1">{editError}</div>
						{/if}
						<div class="mt-2 flex justify-end gap-2">
							<button onclick={handleCancelEdit} class="btn btn-sm btn-ghost">{m.cancel_button()}</button>
							<button onclick={handleSaveEdit} class="btn btn-sm btn-primary" disabled={isSavingEdit || editedRawText.length < 10}>
								{#if isSavingEdit}
									<span class="loading loading-spinner"></span>
									{m.saving_button()}
								{:else}
									{m.save_button()}
								{/if}
							</button>
						</div>
					{:else}
						<p class="leading-relaxed whitespace-pre-wrap text-base-content/80">
							{dream.rawText}
						</p>
					{/if}
				</div>

				<div class="mb-6">
					<div class="mb-2 flex items-center justify-between">
						<h3 class="text-lg font-semibold">{m.interpretation_heading()}</h3>
						{#if !isEditingInterpretation}
							<button onclick={toggleInterpretationEditMode} class="btn btn-sm btn-ghost">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
								</svg>
								{m.edit_button()}
							</button>
						{/if}
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

					{#if isEditingInterpretation}
						<textarea
							class="textarea textarea-bordered w-full h-48"
							bind:value={editedInterpretationText}
							minlength="10"
						></textarea>
						{#if interpretationEditError}
							<div class="text-error text-sm mt-1">{interpretationEditError}</div>
						{/if}
						<div class="mt-2 flex justify-end gap-2">
							<button onclick={handleCancelInterpretationEdit} class="btn btn-sm btn-ghost">{m.cancel_button()}</button>
							<button onclick={handleSaveInterpretationEdit} class="btn btn-sm btn-primary" disabled={isSavingInterpretationEdit || editedInterpretationText.length < 10}>
								{#if isSavingInterpretationEdit}
									<span class="loading loading-spinner"></span>
									{m.saving_button()}
								{:else}
									{m.save_button()}
								{/if}
							</button>
						</div>
					{:else if currentDreamStatus === 'pending_analysis' && !isLoadingStream && !streamError}
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
						<button class="btn btn-error" onclick={handleDeleteDream} disabled={isDeleting}>
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
	{/if}
</div>

