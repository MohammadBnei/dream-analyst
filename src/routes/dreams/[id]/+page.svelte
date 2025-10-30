<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { onDestroy, onMount } from 'svelte';
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
	import DreamMetadata from '$lib/client/components/DreamMetadata.svelte';
	import DeleteDreamModal from '$lib/client/components/DeleteDreamModal.svelte';
	import DreamDateSection from '$lib/client/components/DreamDateSection.svelte';

	let { data, form } = $props();

	let dream = $state(data.dream);
	let nextDreamId = $state(data.nextDreamId);
	let prevDreamId = $state(data.prevDreamId);

	type DreamStatus = typeof dream.status;

	let streamedInterpretation = $state(dream.interpretation || '');
	let streamedTags = $state<string[]>((dream.tags as string[]) || []);

	let isLoadingStream = $state(false);
	let streamError = $state<string | null>(null);

	let analysisService: DreamAnalysisService | null = $state(null);
	let clientChatService: ClientChatService | null = $state(null);

	let selectedPromptType: DreamPromptType = (dream.promptType as DreamPromptType) || 'jungian';

	// Chat specific states
	let chatMessages = $state<any[]>([]);

	// Update dream state when data from load function changes (e.g., after form action)
	$effect(() => {
		if (data.dream && dream.updatedAt !== data.dream.updatedAt) {
			dream = data.dream;
			nextDreamId = data.nextDreamId;
			prevDreamId = data.prevDreamId;
			if (!isLoadingStream) {
				streamedInterpretation = dream.interpretation || '';
				streamedTags = (dream.tags as string[]) || [];
			}
			selectedPromptType = (dream.promptType as DreamPromptType) || 'jungian';
		}
	});

	// Handle form action responses for errors
	$effect(() => {
		if (form?.success) {
			if (form.dream) {
				dream = form.dream;
			}
			// Invalidate 'dream' to ensure the latest DB state is fetched after any successful form action
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
		}
	});

	onMount(async () => {
		if (dream.status === 'PENDING_ANALYSIS') {
			console.log('Dream is pending analysis on mount, attempting to start stream...');
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
		dream.status = 'PENDING_ANALYSIS'; // Optimistically set status

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
				await invalidate('dream'); // Invalidate to ensure latest DB state
			},
			onError: (errorMsg) => {
				console.error('Stream error:', errorMsg);
				isLoadingStream = false;
				dream.status = 'ANALYSIS_FAILED';
				streamError = errorMsg;
			},
			onClose: () => {
				console.log('Analysis service stream closed.');
				isLoadingStream = false;
			}
		});
		analysisService.startStream(promptType);
	}

	function handleCancelAnalysis() {
		analysisService?.closeStream(); // This will now explicitly abort the stream and call onClose
		isLoadingStream = false;
		streamError = 'Analysis cancelled by user.';
		// The form submission for cancelling analysis is now handled by DreamInterpretationSection
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
</script>

<div class="container mx-auto max-w-4xl p-4">
	{#if data.dream}
		<DreamHeader dreamStatus={dream.status} onDeleteClick={openDeleteModal} />

		<div class="card bg-base-100 p-6 shadow-xl">
			<div class="card-body p-0">
				<DreamNavigation dreamDate={dream.dreamDate} {prevDreamId} {nextDreamId}>
					<svelte:fragment slot="status-badge">
						<DreamStatusBadge status={dream.status} />
					</svelte:fragment>
				</DreamNavigation>

				<DreamDateSection dreamDate={dream.dreamDate} onUpdate={handleDreamUpdate} />

				<DreamRawTextSection rawText={dream.rawText} onUpdate={handleDreamUpdate} />

				<DreamInterpretationSection
					dreamId={dream.id}
					interpretation={streamedInterpretation}
					tags={streamedTags}
					status={dream.status}
					promptType={selectedPromptType}
					{isLoadingStream}
					{streamError}
					onRegenerateAnalysis={startStream}
					onCancelAnalysis={handleCancelAnalysis}
				/>

				{#if dream.interpretation}
					<DreamChatSection
						dreamId={dream.id}
						initialChatMessages={chatMessages}
						chatServiceInstance={clientChatService}
					/>
				{/if}

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
