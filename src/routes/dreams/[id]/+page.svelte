<script lang="ts">
	import { goto } from '$app/navigation';
	import { onDestroy, onMount } from 'svelte';
	import * as m from '$lib/paraglide/messages';
	import { DreamAnalysisService } from '$lib/client/services/dreamAnalysisService';
	import StreamedAnalysisDisplay from '$lib/client/components/StreamedAnalysisDisplay.svelte';
    import RichTextInput from '$lib/client/components/RichTextInput.svelte'; // Import the RichTextInput component

	let { params } = $props();
	const dreamId = params.id;

	let dream: App.Dream | null = null;
	let isLoadingDream = true;
	let dreamError: string | null = null;

	let streamedInterpretation = $state('');
	let streamedTags = $state<string[]>([]);
	let currentDreamStatus = $state<App.Dream['status']>('pending_analysis');

	let isLoadingStream = $state(false);
	let streamError = $state<string | null>(null);

	let showDeleteModal = $state(false);
	let isDeleting = $state(false);
	let deleteError = $state<string | null>(null);

	let isEditing = $state(false);
	let editedRawText = $state('');
	let isSavingEdit = $state(false);
	let editError = $state<string | null>(null);

	let isEditingInterpretation = $state(false);
	let editedInterpretationText = $state('');
	let isSavingInterpretationEdit = $state(false);
	let interpretationEditError = $state<string | null>(null);

	let analysisService: DreamAnalysisService | null = null;

	onMount(async () => {
		await fetchDream();
	});

	onDestroy(() => {
		analysisService?.closeStream();
	});

	async function fetchDream() {
		isLoadingDream = true;
		dreamError = null;
		try {
			const response = await fetch(`/api/dreams/${dreamId}`);
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to fetch dream.');
			}
			dream = await response.json();
			if (dream) {
				streamedInterpretation = dream.interpretation || '';
				streamedTags = dream.tags || [];
				currentDreamStatus = dream.status;
				editedRawText = dream.rawText;
				editedInterpretationText = dream.interpretation || '';

				if (dream.status === 'pending_analysis') {
					console.log('Dream is pending analysis on mount, attempting to start stream...');
					startStream();
				}
			}
		} catch (e: any) {
			console.error(`Error fetching dream ${dreamId}:`, e);
			dreamError = e.message || 'An unknown error occurred while fetching the dream.';
		} finally {
			isLoadingDream = false;
		}
	}

	// Function to determine badge color based on dream status
	function getStatusBadgeClass(status: App.Dream['status']) {
		switch (status) {
			case 'completed':
				return 'badge-success';
			case 'pending_analysis':
			case 'pending_stream': // Assuming a new status for when stream is pending
				return 'badge-info';
			case 'analysis_failed':
				return 'badge-error';
			default:
				return 'badge-neutral';
		}
	}

	function startStream() {
		if (!dream?.id) {
			console.warn('Cannot start stream: dream ID is not available.');
			return;
		}

		isLoadingStream = true;
		streamError = null;
		currentDreamStatus = 'pending_analysis'; // Optimistic update for UI

		analysisService = new DreamAnalysisService(dream.id, {
			onMessage: (data) => {
				isLoadingStream = false;
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
				await fetchDream(); // Re-fetch dream to get the final persisted status
			},
			onError: (errorMsg) => {
				console.error('Stream error:', errorMsg);
				isLoadingStream = false;
				currentDreamStatus = 'analysis_failed';
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

		analysisService?.closeStream();
		streamedInterpretation = '';
		streamedTags = [];
		streamError = null;
		currentDreamStatus = 'pending_analysis';
		isLoadingStream = true;

		try {
			const response = await fetch(`/api/dreams/${dream.id}/reset-status`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to reset analysis status.');
			}

			await fetchDream(); // Refresh to get the updated dream object
			startStream();
		} catch (e: any) {
			console.error('Error regenerating analysis:', e);
			streamError = e.message || m.unknown_error_regenerating_analysis();
			currentDreamStatus = 'analysis_failed';
			isLoadingStream = false;
		}
	}

	async function handleDeleteDream() {
		if (!dream?.id) return;

		isDeleting = true;
		deleteError = null;
		try {
			const response = await fetch(`/api/dreams/${dream.id}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to delete dream.');
			}

			await goto('/dreams');
		} catch (e: any) {
			console.error('Error deleting dream:', e);
			deleteError = e.message || m.unknown_error_deleting_dream();
		} finally {
			isDeleting = false;
			showDeleteModal = false;
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

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to update dream status.');
			}

			currentDreamStatus = newStatus as App.Dream['status'];
			await fetchDream();
			console.log('Dream status updated successfully!');
		} catch (e: any) {
			console.error('Error updating dream status:', e);
			alert(`Error updating dream status: ${e.message}`);
			target.value = dream.status;
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
			editedRawText = dream?.rawText || '';
			editError = null;
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
			const response = await fetch(`/api/dreams/${dream.id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ rawText: editedRawText })
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to update dream.');
			}

			await fetchDream();
			isEditing = false;
			console.log('Dream raw text updated successfully!');
		} catch (e: any) {
			console.error('Error saving dream edit:', e);
			editError = e.message || m.unknown_error_saving_dream();
		} finally {
			isSavingEdit = false;
		}
	}

	function handleCancelEdit() {
		isEditing = false;
		editedRawText = dream?.rawText || '';
		editError = null;
	}

	function toggleInterpretationEditMode() {
		isEditingInterpretation = !isEditingInterpretation;
		if (isEditingInterpretation) {
			editedInterpretationText = dream?.interpretation || '';
			interpretationEditError = null;
		}
	}

	async function handleSaveInterpretationEdit() {
		if (!dream?.id || editedInterpretationText.length < 10) {
			interpretationEditError = m.interpretation_text_too_short_error();
			return;
		}

		isSavingInterpretationEdit = true;
		interpretationEditError = null;
		try {
			const response = await fetch(`/api/dreams/${dream.id}/interpretation`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ interpretation: editedInterpretationText })
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to update interpretation.');
			}

			await fetchDream();
			isEditingInterpretation = false;
			console.log('Dream interpretation updated successfully!');
		} catch (e: any) {
			console.error('Error saving interpretation edit:', e);
			interpretationEditError = e.message || m.unknown_error_saving_interpretation();
		} finally {
			isSavingInterpretationEdit = false;
		}
	}

	function handleCancelInterpretationEdit() {
		isEditingInterpretation = false;
		editedInterpretationText = dream?.interpretation || '';
		interpretationEditError = null;
	}

    function handleRawTextInput(value: string) {
        editedRawText = value;
    }

    function handleInterpretationInput(value: string) {
        editedInterpretationText = value;
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

	{#if isLoadingDream}
		<div class="flex justify-center items-center h-64">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if dreamError}
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
			<span>Error loading dream: {dreamError}</span>
			<button class="btn btn-sm btn-ghost" on:click={fetchDream}>Retry</button>
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
						<RichTextInput
                            placeholder={m.raw_dream_text_heading()}
                            rows={8}
                            bind:value={editedRawText}
                            onInput={handleRawTextInput}
                        />
						{#if editError}
							<div class="text-error text-sm mt-1">{editError}</div>
						{/if}
						<div class="mt-2 flex justify-end gap-2">
							<button onclick={handleCancelEdit} class="btn btn-sm btn-ghost">{m.cancel_button()}</button>
							<button onclick={handleSaveEdit} class="btn btn-sm btn-primary" disabled={isSavingEdit || editedRawText.length < 10}>
								{#if isSavingEdit}
									<span class="loading loading-spinner"></span>
									{m.save_button()}
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
						<RichTextInput
                            placeholder={m.interpretation_heading()}
                            rows={8}
                            bind:value={editedInterpretationText}
                            onInput={handleInterpretationInput}
                        />
						{#if interpretationEditError}
							<div class="text-error text-sm mt-1">{interpretationEditError}</div>
						{/if}
						<div class="mt-2 flex justify-end gap-2">
							<button onclick={handleCancelInterpretationEdit} class="btn btn-sm btn-ghost">{m.cancel_button()}</button>
							<button onclick={handleSaveInterpretationEdit} class="btn btn-sm btn-primary" disabled={isSavingInterpretationEdit || editedInterpretationText.length < 10}>
								{#if isSavingInterpretationEdit}
									<span class="loading loading-spinner"></span>
									{m.save_button()}
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
