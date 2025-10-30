<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { onDestroy, onMount } from 'svelte';
	import * as m from '$lib/paraglide/messages';
	import { DreamAnalysisService } from '$lib/client/services/dreamAnalysisService';
	import StreamedAnalysisDisplay from '$lib/client/components/StreamedAnalysisDisplay.svelte';
	import RichTextInput from '$lib/client/components/RichTextInput.svelte';
	import { enhance } from '$app/forms';
	import { DreamStatus } from '@prisma/client'; // Import the Prisma DreamStatus enum

	let { data, form } = $props();

	const dreamId = data.dream.id;

	let dream = $state(data.dream);

	console.log({ dream });

	let streamedInterpretation = $state(dream.interpretation || '');
	let streamedTags = $state<string[]>(dream.tags || []);
	let currentDreamStatus = $state<DreamStatus>(dream.status); // Use DreamStatus enum

	let isLoadingStream = $state(false);
	let streamError = $state<string | null>(null);

	let showDeleteModal = $state(false);
	let isDeleting = $state(false);
	let deleteError = $state<string | null>(null);

	let isEditing = $state(false);
	let editedRawText = $state(dream.rawText);
	let isSavingEdit = $state(false);
	let editError = $state<string | null>(null);

	let isEditingInterpretation = $state(false);
	let editedInterpretationText = $state(dream.interpretation || '');
	let isSavingInterpretationEdit = $state(false);
	let interpretationEditError = $state<string | null>(null);

	let analysisService: DreamAnalysisService | null = null;

	// Update dream state when data from load function changes (e.g., after form action)
	$effect(() => {
		// Only update if the incoming dream data is different from the current state
		// This prevents an infinite loop if `dream` is updated and then `data.dream` is still the same
		// We compare `updatedAt` as a simple way to check if the dream object itself has changed.
		if (data.dream && dream.updatedAt !== data.dream.updatedAt) {
			dream = data.dream;
			// Only update streamed content if it's not actively streaming
			if (!isLoadingStream) {
				streamedInterpretation = dream.interpretation || '';
				streamedTags = dream.tags || [];
			}
			// currentDreamStatus is derived, so no direct assignment needed here
			editedRawText = dream.rawText;
			editedInterpretationText = dream.interpretation || '';
		}
	});

	// Handle form action responses
	$effect(() => {
		if (form?.success) {
			if (form.dream) {
				// When a form action successfully updates the dream, update the local state
				// This will then trigger the $effect above to synchronize other related states
				dream = form.dream;
			}
			if (form.message) {
				console.log(form.message);
			}
		}
		if (form?.error) {
			console.error('Form action error:', form.error);
			// Specific error handling for different actions
			if (form.rawText !== undefined) {
				editError = form.error;
			} else if (form.interpretation !== undefined) {
				interpretationEditError = form.error;
			} else if (form.error && form.error.includes('delete')) {
				deleteError = form.error;
			} else {
				streamError = form.error; // Generic error for other actions
			}
		}

		// Reset saving states
		isSavingEdit = false;
		isSavingInterpretationEdit = false;
		isDeleting = false;
	});

	onMount(() => {
		if (dream.status === DreamStatus.PENDING_ANALYSIS) { // Use enum
			console.log('Dream is pending analysis on mount, attempting to start stream...');
			startStream();
		}
	});

	onDestroy(() => {
		analysisService?.closeStream();
	});

	// Function to determine badge color based on dream status
	function getStatusBadgeClass(status: DreamStatus) { // Use DreamStatus enum
		switch (status) {
			case DreamStatus.COMPLETED:
				return 'badge-success';
			case DreamStatus.PENDING_ANALYSIS:
			case 'pending_stream': // Assuming a new status for when stream is pending
				return 'badge-info';
			case DreamStatus.ANALYSIS_FAILED:
				return 'badge-error';
			default:
				return 'badge-neutral';
		}
	}

	function startStream() {
		if (!dream.id) {
			console.warn('Cannot start stream: dream ID is not available.');
			return;
		}

		isLoadingStream = true;
		streamError = null;

		analysisService = new DreamAnalysisService(dream.id, {
			onMessage: (data) => {
				// isLoadingStream remains true until onEnd or onError
				if (data.content) {
					streamedInterpretation += data.content;
				}
				if (data.tags) {
					streamedTags = data.tags;
				}
				if (data.status) {
					// Update dream status directly if it comes from the stream
					dream.status = data.status as DreamStatus;
				}
			},
			onEnd: async (data) => {
				console.log('Stream ended:', data);
				isLoadingStream = false;
				if (data.status) {
					dream.status = data.status as DreamStatus;
				}
				if (data.message) {
					streamError = data.message;
				}
				await invalidate('dream'); // Invalidate to ensure latest DB state is fetched
			},
			onError: (errorMsg) => {
				console.error('Stream error:', errorMsg);
				isLoadingStream = false;
				dream.status = DreamStatus.ANALYSIS_FAILED; // Use enum
				streamError = errorMsg;
			},
			onClose: () => {
				console.log('Analysis service stream closed.');
				isLoadingStream = false; // Ensure loading is false when stream closes
			}
		});
		analysisService.startStream();
	}

	async function cancelStream() {
		if (!dream.id) return;

		if (!confirm('Are you sure you want to cancel the ongoing analysis?')) {
			return;
		}

		analysisService?.closeStream(); // Close client-side stream immediately
		isLoadingStream = false; // Update UI
		streamError = 'Analysis cancelled by user.'; // Set a message

		// Trigger server action to update status and notify background process
		// The dreamId is already in the URL params, so no need to send it in formData
		const response = await fetch('?/cancelAnalysis', {
			method: 'POST'
		});

		if (response.ok) {
			console.log('Analysis cancellation initiated on server.');
			await invalidate('dream'); // Re-fetch dream data to update status
		} else {
			const errorData = await response.json();
			console.error('Failed to cancel analysis on server:', errorData.error);
			streamError = errorData.error || 'Failed to cancel analysis on server.';
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
			editedRawText = dream.rawText;
			editError = null;
		}
	}

	function handleCancelEdit() {
		isEditing = false;
		editedRawText = dream.rawText;
		editError = null;
	}

	function toggleInterpretationEditMode() {
		isEditingInterpretation = !isEditingInterpretation;
		if (isEditingInterpretation) {
			editedInterpretationText = dream.interpretation || '';
			interpretationEditError = null;
		}
	}

	function handleCancelInterpretationEdit() {
		isEditingInterpretation = false;
		editedInterpretationText = dream.interpretation || '';
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
			<button onclick={handleShowDeleteModal} class="btn btn-sm btn-error">
				{m.delete_dream_button()}
			</button>
		</div>
	</div>

	{#if data.dream}
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
						{#if currentDreamStatus === DreamStatus.PENDING_ANALYSIS}
							<form method="POST" action="?/updateStatus" use:enhance>
								<select name="status" class="select-bordered select select-sm">
									<option value="" disabled selected>{m.change_status_option()}</option>
									<option value={DreamStatus.ANALYSIS_FAILED}>{m.reset_to_failed_analysis_option()}</option>
								</select>
							</form>
						{/if}
					</div>
				</div>

				<div class="mb-6">
					<div class="mb-2 flex items-center justify-between">
						<h3 class="text-lg font-semibold">{m.raw_dream_text_heading()}</h3>
						{#if !isEditing}
							<button onclick={toggleEditMode} class="btn btn-ghost btn-sm">
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
					{#if isEditing}
						<form
							method="POST"
							action="?/updateDream"
							use:enhance={() => {
								isSavingEdit = true;
								return async ({ update }) => {
									await update();
									isEditing = false; // Exit edit mode on success or failure
								};
							}}
						>
							<RichTextInput
								name="rawText"
								placeholder={m.raw_dream_text_heading()}
								rows={8}
								bind:value={editedRawText}
								onInput={handleRawTextInput}
							/>
							{#if editError}
								<div class="mt-1 text-sm text-error">{editError}</div>
							{/if}
							<div class="mt-2 flex justify-end gap-2">
								<button onclick={handleCancelEdit} type="button" class="btn btn-ghost btn-sm"
									>{m.cancel_button()}</button
								>
								<button
									type="submit"
									class="btn btn-sm btn-primary"
									disabled={isSavingEdit || editedRawText.length < 10}
								>
									{#if isSavingEdit}
										<span class="loading loading-spinner"></span>
										{m.save_button()}
									{:else}
										{m.save_button()}
									{/if}
								</button>
							</div>
						</form>
					{:else}
						<p class="leading-relaxed whitespace-pre-wrap text-base-content/80">
							{dream.rawText}
						</p>
					{/if}
				</div>

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
							{#if currentDreamStatus === DreamStatus.COMPLETED || currentDreamStatus === DreamStatus.ANALYSIS_FAILED}
								<form
									method="POST"
									action="?/resetAnalysis"
									use:enhance={() => {
										isLoadingStream = true; // Optimistically set loading state
										streamedInterpretation = ''; // Clear previous interpretation
										streamedTags = []; // Clear previous tags
										streamError = null; // Clear previous error
										dream.status = DreamStatus.PENDING_ANALYSIS; // Optimistically set status
										return async ({ update, result }) => {
											await update(); // Update page data from server response
											if (result.type === 'success') {
												startStream(); // Start the stream if reset was successful
											} else {
												isLoadingStream = false; // Reset loading on error
											}
										};
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
							{/if}
							{#if currentDreamStatus === DreamStatus.PENDING_ANALYSIS && isLoadingStream}
								<button onclick={cancelStream} class="btn btn-sm btn-warning">
									{m.cancel_analysis_button()}
								</button>
							{/if}
						</div>
					</div>

					{#if isEditingInterpretation}
						<form
							method="POST"
							action="?/updateInterpretation"
							use:enhance={() => {
								isSavingInterpretationEdit = true;
								return async ({ update }) => {
									await update();
									isEditingInterpretation = false; // Exit edit mode on success or failure
								};
							}}
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
								<button
									onclick={handleCancelInterpretationEdit}
									type="button"
									class="btn btn-ghost btn-sm">{m.cancel_button()}</button
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
					{:else if currentDreamStatus === DreamStatus.PENDING_ANALYSIS && !isLoadingStream && !streamError}
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
					{:else if currentDreamStatus === DreamStatus.ANALYSIS_FAILED && !isLoadingStream && !streamError}
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
						<button onclick={startStream} class="btn mt-4 btn-primary"
							>{m.retry_analysis_button()}</button
						>
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
					<h3 class="text-lg font-bold">{m.confirm_deletion_title()}</h3>
					<p class="py-4">{m.confirm_deletion_message()}</p>
					{#if deleteError}
						<div class="mb-4 alert alert-error shadow-lg">
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
						<button
							onclick={handleCancelDelete}
							type="button"
							class="btn btn-ghost"
							disabled={isDeleting}>{m.cancel_button()}</button
						>
						<form
							method="POST"
							action="?/deleteDream"
							use:enhance={() => {
								isDeleting = true;
								return async ({ update }) => {
									await update();
									// Redirection is handled by the action, so no need to set isDeleting to false here
								};
							}}
						>
							<button type="submit" class="btn btn-error" disabled={isDeleting}>
								{#if isDeleting}
									<span class="loading loading-spinner"></span>
									{m.deleting_button()}
								{:else}
									{m.delete_button()}
								{/if}
							</button>
						</form>
					</div>
				</div>
			</dialog>
		{/if}
	{:else}
		<!-- This block handles the case where data.dream is null, e.g., if the load function threw an error -->
		<div role="alert" class="alert alert-error">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-6 w-6 shrink-0 stroke-current"
				fill="none"
				viewBox="0 0 24 24"
				><path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
				></path></svg
			>
			<span>Error loading dream details.</span>
		</div>
	{/if}
</div>
