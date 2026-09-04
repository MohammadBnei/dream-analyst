<script lang="ts">
	import { Streamdown } from 'svelte-streamdown';
	import * as m from '$lib/paraglide/messages';

	let { interpretation, isLoading, errorMessage, status } = $props<{
		interpretation: string;
		isLoading: boolean;
		errorMessage: string | null;
		status: 'PENDING_ANALYSIS' | 'COMPLETED' | 'ANALYSIS_FAILED' | 'idle';
	}>();
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

	{#if !isLoading && !errorMessage && !interpretation && status === 'idle'}
		<p class="mt-4 text-center text-sm text-base-content/70">
			{m.dream_analysis_instant_message()}
		</p>
	{/if}
</div>
