<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { DreamAnalysisService } from '$lib/client/services/dreamAnalysisService';
	import { ClientChatService } from '$lib/client/services/chatService';
	import type { DreamPromptType } from '$lib/prompts/dreamAnalyst';

	// New Components
	import DreamHeader from '$lib/client/components/DreamHeader.svelte';
	import DreamNavigation from '$lib/client/components/DreamNavigation.svelte';
	import DreamStatusBadge from '$lib/client/components/DreamStatusBadge.svelte';
	import DreamRawTextSection from '$lib/client/components/DreamRawTextSection.svelte';
	import DreamInterpretationSection from '$lib/client/components/DreamInterpretationSection.svelte';
	import DreamChatSection from '$lib/client/components/DreamChatSection.svelte';
	import DeleteDreamModal from '$lib/client/components/DeleteDreamModal.svelte';
	import DreamDateSection from '$lib/client/components/DreamDateSection.svelte';
	import DreamRelatedDreams from '$lib/client/components/DreamRelatedDreams.svelte'; // Import the new component
	import DreamMetadata from '$lib/client/components/DreamMetadata.svelte';
	import { getDream, updateDream } from '$lib/remote/dream.remote.js';

	let { data, form } = $props();

	// Initialize with data from the load function
	let dream = $state(data.dream);
	let nextDreamId = $state(data.nextDreamId);
	let prevDreamId = $state(data.prevDreamId);

	type DreamStatus = typeof dream.status;

	// These states are for real-time streaming updates, not direct dream properties
	let streamedInterpretation = $state(dream.interpretation || '');
	let streamedTags = $state<string[]>((dream.tags as string[]) || []);

	let isLoadingStream = $state(false);
	let streamError = $state<string | null>(null);
	// isRegeneratingTitle is now managed locally within DreamHeader.svelte
	// isUpdatingTitle is now managed locally within DreamHeader.svelte
	let isUpdatingRelatedDreams = $state(false); // New state for updating related dreams
	let isRegeneratingRelatedDreams = $state(false); // New state for regenerating related dreams

	let analysisService: DreamAnalysisService | null = $state(null);
	// ClientChatService is instantiated within DreamChatSection, so no need for a top-level state here.
	// let clientChatService: ClientChatService | null = $state(null);

	// Initialize selectedPromptType from dream data
	let selectedPromptType: DreamPromptType = $state(
		(dream.promptType as DreamPromptType) || 'jungian'
	);

	// Effect to update local state when data from load function changes
	$effect(() => {
		if (data.dream) {
			// Only update if the dream object itself has changed (e.g., ID or updatedAt)
			// or if it's the initial load.
			if (!dream || dream.id !== data.dream.id || dream.updatedAt !== data.dream.updatedAt) {
				dream = data.dream;
				nextDreamId = data.nextDreamId;
				prevDreamId = data.prevDreamId;

				// Reset streamed interpretation/tags if not actively streaming
				// or if the dream ID has changed (navigating to a new dream)
				if (!isLoadingStream || dream.id !== data.dream.id) {
					streamedInterpretation = dream.interpretation || '';
					streamedTags = (dream.tags as string[]) || [];
				}
				selectedPromptType = (dream.promptType as DreamPromptType) || 'jungian';
			}
		}
	});

	// Handle form action responses for errors and successful updates
	$effect(() => {
		if (form?.success) {
			// Invalidate 'dream' to ensure the latest DB state is fetched after any successful form action
			// The $effect watching `data.dream` will then update the local `dream` state.
			invalidate('dream');
		}
		if (form?.error) {
			console.error('Form action error:', form.error);
			// Specific error handling for interpretation and raw text is now within their components
			// This top-level error is for general page-level errors or those not handled by sub-components
			if (form.error && form.error.includes('delete')) {
				// This error will be passed to DeleteDreamModal
			} else {
				streamError = form.error; // General stream error
			}
			isLoadingStream = false;
		}
	});

	onMount(async () => {
		if (dream.status === 'PENDING_ANALYSIS') {
			console.log('Dream is pending analysis on mount, attempting to start stream...');
			// Use the dream's promptType to start the stream
			startStream(selectedPromptType);
		}
	});

	// Removed onDestroy hook to prevent stream abortion on page navigation

	function startStream(promptType: DreamPromptType) {
		if (!dream.id) {
			console.warn('Cannot start stream: dream ID is not available.');
			return;
		}

		isLoadingStream = true;
		streamError = null;
		streamedInterpretation = ''; // Clear previous interpretation
		streamedTags = []; // Clear previous tags
		// Optimistically set status, but the final status will come from the stream or DB
		dream.status = 'PENDING_ANALYSIS';

		analysisService = new DreamAnalysisService(dream.id, {
			onMessage: (data) => {
				if (data.content) {
					streamedInterpretation += data.content;
				}
				if (data.tags) {
					streamedTags = data.tags;
				}
				if (data.status) {
					dream.status = data.status as DreamStatus;
				}
			},
			onEnd: async (data) => {
				isLoadingStream = false;
				if (data.status) {
					dream.status = data.status as DreamStatus;
				}
				if (data.message) {
					streamError = data.message;
				}
				await invalidate('dream'); // Invalidate to ensure latest DB state, including final interpretation/tags/status
			},
			onError: (errorMsg) => {
				console.error('Stream error:', errorMsg);
				isLoadingStream = false;
				dream.status = 'ANALYSIS_FAILED'; // Update local status for immediate feedback
				streamError = errorMsg;
				invalidate('dream'); // Invalidate to persist the failed status
			},
			onClose: () => {
				console.log('Analysis service stream closed.');
				isLoadingStream = false;
				// No invalidate here, as onEnd or onError would have already handled final state.
			}
		});
		analysisService.startStream(promptType);
	}

	function handleCancelAnalysis() {
		analysisService?.closeStream(); // This will now explicitly abort the stream and call onClose
		isLoadingStream = false;
		streamError = 'Analysis cancelled by user.';
		// The form submission for cancelling analysis is now handled by DreamInterpretationSection
		// which should trigger an invalidate('dream') on success.
	}

	function openDeleteModal() {
		const checkbox = document.getElementById('delete_dream_modal') as HTMLInputElement;
		if (checkbox) checkbox.checked = true;
	}

	function handleDreamUpdate() {
		// This function can be called by child components to trigger a re-fetch of dream data
		// if their internal state changes and needs to be reflected in the parent or other components.
		invalidate('dream');
	}

	// handleRegenerateTitle function is removed as DreamHeader now handles its own form submission.
	// async function handleRegenerateTitle() {
	// 	if (!dream.id) {
	// 		console.warn('Cannot regenerate title: dream ID is not available.');
	// 		return;
	// 	}
	// 	isRegeneratingTitle = true;
	// 	try {
	// 		const response = await fetch(`/api/dreams/${dream.id}/regenerate-title`, {
	// 			method: 'POST',
	// 			headers: {
	// 				'Content-Type': 'application/json'
	// 			}
	// 		});

	// 		if (response.ok) {
	// 			// On success, invalidate to re-fetch the dream with the new title
	// 			await invalidate('dream');
	// 		} else {
	// 			const errorData = await response.json();
	// 			console.error('Error regenerating title:', errorData.error);
	// 			streamError = errorData.error;
	// 		}
	// 	} catch (error) {
	// 		console.error('Network error regenerating title:', error);
	// 		streamError = 'Network error regenerating title.';
	// 	} finally {
	// 		isRegeneratingTitle = false;
	// 	}
	// }

	async function handleUpdateRelatedDreams(updatedRelatedIds: string[]) {
		if (!dream.id) {
			console.warn('Cannot update related dreams: dream ID is not available.');
			return;
		}
		isUpdatingRelatedDreams = true;
		const formData = new FormData();
		formData.append('relatedDreamIds', JSON.stringify(updatedRelatedIds));

		try {
			const response = await fetch(`/dreams/${dream.id}?/updateRelatedDreams`, {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				// On success, invalidate to re-fetch the dream with the new related dreams
				await invalidate('dream');
			} else {
				const errorData = await response.json();
				console.error('Error updating related dreams:', errorData.error);
				streamError = errorData.error;
			}
		} catch (error) {
			console.error('Network error updating related dreams:', error);
			streamError = 'Network error updating related dreams.';
		} finally {
			isUpdatingRelatedDreams = false;
		}
	}

	async function handleRegenerateRelatedDreams() {
		if (!dream.id) {
			console.warn('Cannot regenerate related dreams: dream ID is not available.');
			return;
		}
		isRegeneratingRelatedDreams = true;
		try {
			const response = await fetch(`/api/dreams/${dream.id}/regenerate-related-dreams`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (response.ok) {
				// On success, invalidate to re-fetch the dream with the new related dreams
				await invalidate('dream');
			} else {
				const errorData = await response.json();
				console.error('Error regenerating related dreams:', errorData.error);
				streamError = errorData.error;
			}
		} catch (error) {
			console.error('Network error regenerating related dreams:', error);
			streamError = 'Network error regenerating related dreams.';
		} finally {
			isRegeneratingRelatedDreams = false;
		}
	}
</script>

<div class="container mx-auto max-w-4xl md:p-4">
	{#if data.dream}
		<div class="mb-4 flex items-center justify-between">
			<DreamHeader
				dreamStatus={dream.status}
				onDeleteClick={openDeleteModal}
				dreamTitle={dream.title}
			/>
		</div>

		<div class="card bg-base-100 p-3 py-6 shadow-xl md:p-6">
			<div class="card-body p-0">
				<DreamNavigation dreamDate={dream.dreamDate} {prevDreamId} {nextDreamId}>
					<svelte:fragment slot="status-badge">
						<DreamStatusBadge status={dream.status} />
					</svelte:fragment>
				</DreamNavigation>

				<DreamDateSection dreamDate={dream.dreamDate} onUpdate={handleDreamUpdate} />

				<button
					class="btn mt-2 btn-ghost btn-sm"
					onclick={async () => {
						const data = await updateDream({
							dreamId: dream.id,
							rawText: dream.rawText
						});
						console.log({ data });
					}}
				>
					CLICK ME
				</button>

				<DreamRawTextSection rawText={dream.rawText} onUpdate={handleDreamUpdate} />

				<DreamInterpretationSection
					interpretation={streamedInterpretation}
					tags={streamedTags}
					status={dream.status}
					promptType={selectedPromptType}
					bind:isLoadingStream
					{streamError}
					onRegenerateAnalysis={startStream}
					onCancelAnalysis={handleCancelAnalysis}
				/>

				{#if !isLoadingStream}
					<DreamChatSection dreamId={dream.id} />
				{/if}

				<DreamRelatedDreams
					dreamId={dream.id}
					relatedDreams={dream.relatedTo || []}
					onUpdateRelatedDreams={handleUpdateRelatedDreams}
					{isUpdatingRelatedDreams}
					onRegenerateRelatedDreams={handleRegenerateRelatedDreams}
					{isRegeneratingRelatedDreams}
				/>

				<DreamMetadata createdAt={dream.createdAt} updatedAt={dream.updatedAt} />
			</div>
		</div>
	{:else}
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

<DeleteDreamModal onDeleteSuccess={handleDreamUpdate} />
