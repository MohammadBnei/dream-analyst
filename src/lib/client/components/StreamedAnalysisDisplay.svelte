<script lang="ts">
	import { Streamdown } from 'svelte-streamdown';
	import * as m from '$lib/paraglide/messages';

	let { interpretation, tags, isLoading, errorMessage, status } = $props<{
		interpretation: string;
		tags: string[];
		isLoading: boolean;
		errorMessage: string | null;
		status: 'PENDING_ANALYSIS' | 'COMPLETED' | 'ANALYSIS_FAILED' | 'idle';
	}>();

	function getStatusBadgeClass(
		currentStatus: 'PENDING_ANALYSIS' | 'COMPLETED' | 'ANALYSIS_FAILED' | 'idle'
	) {
		switch (currentStatus) {
			case 'COMPLETED':
				return 'badge-success';
			case 'PENDING_ANALYSIS':
				return 'badge-info';
			case 'ANALYSIS_FAILED':
				return 'badge-error';
			case 'idle':
			default:
				return 'badge-neutral';
		}
	}
</script>

<div class="mt-8 rounded-box bg-base-200 p-6 shadow-lg">
	{#if isLoading}
		<div class="mb-4 alert alert-info shadow-lg">
			<div>
				<svg class="mr-3 h-5 w-5 animate-spin" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
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
	{/if}

	{#if errorMessage}
		<div role="alert" class="mb-4 alert alert-error">
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
			<span>{m.error_prefix()}: {errorMessage}</span>
		</div>
	{/if}

	{#if tags.length > 0}
		<div class="mb-4">
			<h3 class="mb-2 text-lg font-medium">{m.tags_heading()}:</h3>
			<div class="flex flex-wrap gap-2">
				{#each tags as tag}
					<span class="badge {getStatusBadgeClass(status)} badge-lg">{tag}</span>
				{/each}
			</div>
		</div>
	{/if}

	{#if interpretation}
		<div class="mb-4">
			<div class="prose max-w-none">
				<Streamdown
					animation={{ animateOnMount: true, enabled: isLoading, type: 'blur' }}
					content={interpretation}
				/>
			</div>
		</div>
	{/if}

	{#if !isLoading && !errorMessage && !interpretation && !tags.length && status === 'idle'}
		<p class="mt-4 text-center text-sm text-base-content/70">
			{m.dream_analysis_instant_message()}
		</p>
	{/if}
</div>
