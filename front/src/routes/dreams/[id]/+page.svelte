<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { DreamAnalysisService } from '$lib/client/services/dreamAnalysisService';
	import type { DreamPromptType } from '$lib/promptTypes';

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

	let { data, form } = $props();

	// Derived from load data, not mirrored into $state with a syncing $effect.
	let dream = $derived(data.dream);
	let nextDreamId = $derived(data.nextDreamId);
	let prevDreamId = $derived(data.prevDreamId);

	type DreamStatus = typeof dream.status;

	// Streaming state genuinely IS local: it changes faster than the server knows,
	// and must not be clobbered by an invalidation mid-stream.
	let streamedInterpretation = $state(dream.interpretation || '');
	let streamedTags = $state<string[]>((dream.tags as string[]) || []);

	// Local override so the badge reacts the instant a stream starts or fails,
	// ahead of the DB write. Null means "trust the server".
	let streamStatus = $state<DreamStatus | null>(null);
	let displayStatus = $derived(streamStatus ?? dream.status);

	let isLoadingStream = $state(false);
	let streamError = $state<string | null>(null);
	// isUpdatingTitle is now managed locally within DreamHeader.svelte

	let analysisService: DreamAnalysisService | null = $state(null);
	// ClientChatService is instantiated within DreamChatSection, so no need for a top-level state here.
	// let clientChatService: ClientChatService | null = $state(null);

	// Re-derives when the dream changes, and stays assignable so the select works.
	let selectedPromptType: DreamPromptType = $derived(
		(dream.promptType as DreamPromptType) || 'jungian'
	);

	// Bookkeeping, deliberately NOT $state: it must not itself trigger this effect.
	let lastSyncedDream = '';

	// The only state that cannot be derived. It must adopt the server's values when
	// the dream actually changes, and must NOT be clobbered while a stream is
	// running - the stream is ahead of the database, which is only written at the
	// end. Keyed on id+updatedAt so a re-run with unchanged data is a no-op;
	// syncing on every run would wipe the streamed text the moment the stream
	// finished, before invalidate() had refreshed it.
	$effect(() => {
		const key = `${dream.id}:${dream.updatedAt}`;
		if (key === lastSyncedDream) return;

		const navigatedToAnotherDream = !lastSyncedDream.startsWith(`${dream.id}:`);
		lastSyncedDream = key;

		if (!isLoadingStream || navigatedToAnotherDream) {
			streamedInterpretation = dream.interpretation || '';
			streamedTags = (dream.tags as string[]) || [];
			streamStatus = null;
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
		if (displayStatus === 'PENDING_ANALYSIS') {
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
		streamStatus = 'PENDING_ANALYSIS';

		analysisService = new DreamAnalysisService(dream.id, {
			onMessage: (data) => {
				if (data.content) {
					streamedInterpretation += data.content;
				}
				if (data.tags) {
					streamedTags = data.tags;
				}
				if (data.status) {
					streamStatus = data.status as DreamStatus;
				}
			},
			onEnd: async (data) => {
				isLoadingStream = false;
				if (data.status) {
					streamStatus = data.status as DreamStatus;
				}
				// Only a failure message is an error. This previously assigned any
				// message, so a successful run published "Processing completed." and
				// the UI rendered it in the red error alert.
				streamError = data.status === 'ANALYSIS_FAILED' ? (data.message ?? null) : null;
				await invalidate('dream'); // Invalidate to ensure latest DB state, including final interpretation/tags/status
			},
			onError: (errorMsg) => {
				console.error('Stream error:', errorMsg);
				isLoadingStream = false;
				streamStatus = 'ANALYSIS_FAILED';
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
</script>

<div class="container mx-auto max-w-4xl md:p-4">
	{#if data.dream}
		<div class="mb-4 flex items-center justify-between">
			<DreamHeader
				dreamStatus={displayStatus}
				onDeleteClick={openDeleteModal}
				dreamTitle={dream.title}
			/>
		</div>

		<div class="card bg-base-100 p-3 py-6 shadow-xl md:p-6">
			<div class="card-body p-0">
				<DreamNavigation dreamDate={dream.dreamDate} {prevDreamId} {nextDreamId}>
					{#snippet statusBadge()}
						<DreamStatusBadge status={displayStatus} />
					{/snippet}
				</DreamNavigation>

				<DreamDateSection dreamDate={dream.dreamDate} onUpdate={handleDreamUpdate} />

				<DreamRawTextSection rawText={dream.rawText} onUpdate={handleDreamUpdate} />

				<DreamInterpretationSection
					interpretation={streamedInterpretation}
					tags={streamedTags}
					status={displayStatus}
					promptType={selectedPromptType}
					bind:isLoadingStream
					{streamError}
					onRegenerateAnalysis={startStream}
					onCancelAnalysis={handleCancelAnalysis}
				/>

				{#if !isLoadingStream}
					<DreamChatSection dreamId={dream.id} />
				{/if}

				<DreamRelatedDreams dreamId={dream.id} relatedDreams={dream.relatedTo || []} />

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
