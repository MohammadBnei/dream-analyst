<script lang="ts">
	import { fade } from 'svelte/transition';
	import * as m from '$lib/paraglide/messages';

	interface Props {
		dream: App.Dream;
	}

	let { dream }: Props = $props();

	// 0: Hidden, 1: Clamped, 2: Full
	let rawTextDisplayState: 0 | 1 | 2 = $state(0); // Default to clamped

	function getStatusColorClass(status: App.Dream['status']): string {
		switch (status) {
			case 'COMPLETED':
				return 'text-success';
			case 'PENDING_ANALYSIS':
				return 'text-warning';
			case 'ANALYSIS_FAILED':
				return 'text-error';
			default:
				return 'text-base-content';
		}
	}

	function getStatusIcon(status: App.Dream['status']): string {
		switch (status) {
			case 'COMPLETED':
				return `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>`;
			case 'PENDING_ANALYSIS':
				return `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l3 3a1 1 0 001.414-1.414L11 9.586V6z" clip-rule="evenodd" /></svg>`;
			case 'ANALYSIS_FAILED':
				return `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" /></svg>`;
			default:
				return `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
		}
	}

	function toggleRawTextDisplay() {
		rawTextDisplayState = (rawTextDisplayState + 1) % 3 as 0 | 1 | 2;
	}

	const rawTextClass = $derived(() => {
		return {
			0: 'hidden', // No text
			1: 'line-clamp-3', // Clamped
			2: '' // Full text
		}[rawTextDisplayState];
	});

	const rawTextTooltip = $derived(() => {
		return {
			0: 'Show dream text (clamped)',
			1: 'Show full dream text',
			2: 'Hide dream text'
		}[rawTextDisplayState];
	});

	const isSwapChecked = $derived.by(() => rawTextDisplayState === 2); // Checkbox is 'on' when full text is shown
</script>

<li class="list-row" transition:fade>
	<!-- Status Icon -->
	<div class="flex items-center justify-center {getStatusColorClass(dream.status)}">
		{@html getStatusIcon(dream.status)}
	</div>

	<!-- Title / Date -->
	<div>
		<h2 class="text-lg font-semibold">
			{#if dream.title}
				{dream.title}
			{:else}
				{new Date(dream.dreamDate).toLocaleDateString()}
			{/if}
		</h2>
		{#if dream.title}
			<div class="text-xs font-semibold uppercase opacity-60">
				{new Date(dream.dreamDate).toLocaleDateString()}
			</div>
		{/if}
	</div>

	<!-- Dream Text (truncated or full) -->
	<p class="list-col-wrap text-sm {rawTextClass}">
		{#if rawTextDisplayState !== 0}
			{dream.rawText}
		{/if}
	</p>

	<!-- Toggle Raw Text Button -->
	<button
		class="tooltip btn tooltip-left btn-square btn-ghost"
		data-tip={rawTextTooltip}
		onclick={toggleRawTextDisplay}
	>
		<label class="swap swap-rotate">
			<input type="checkbox" checked={isSwapChecked} onchange={() => {}} />
			<!-- Icon for 'off' state (hidden/clamped) -->
			<div class="swap-off">
				{#if rawTextDisplayState === 0}
					<!-- Hidden icon (closed eye) -->
					<svg class="size-[1.2em]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
						><path
							fill="currentColor"
							d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 13c-2.76 0-5-2.24-5-5s2.24-5 5-5s5 2.24 5 5s-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3s3-1.34 3-3s-1.34-3-3-3z"
						/></svg
					>
				{:else}
					<!-- Clamped icon (open eye) -->
					<svg class="size-[1.2em]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
						><path
							fill="currentColor"
							d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 13c-2.76 0-5-2.24-5-5s2.24-5 5-5s5 2.24 5 5s-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3s3-1.34 3-3s-1.34-3-3-3z"
						/></svg
					>
				{/if}
			</div>
			<!-- Icon for 'on' state (full text) -->
			<div class="swap-on">
				<!-- Full text icon (open eye with lines) -->
				<svg class="size-[1.2em]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
					><path
						fill="currentColor"
						d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5s5-2.24 5-5s-2.24-5-5-5zm0 8c-1.66 0-3-1.34-3-3s1.34-3 3-3s3 1.34 3 3s-1.34 3-3 3zm-7-1h2v-2H5v2zm12-2h2v2h-2v-2zM3 12c0-2.76 2.24-5 5-5h2V5H8c-3.86 0-7 3.14-7 7s3.14 7 7 7h2v-2H8c-2.76 0-5-2.24-5-5zm18 0c0 2.76-2.24 5-5 5h-2v2h2c3.86 0 7-3.14 7-7s-3.14-7-7-7h-2v2h2c2.76 0 5 2.24 5 5z"
					/></svg
				>
			</div>
		</label>
	</button>

	<!-- View Details Button -->
	<a
		href={`/dreams/${dream.id}`}
		class="tooltip btn btn-primary tooltip-left btn-square"
		data-tip={m.view_details_button()}
		aria-label="go to details"
	>
		<svg class="size-[1.2em]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
			><path fill="currentColor" d="M10 6L8.59 7.41L13.17 12l-4.58 4.59L10 18l6-6z" /></svg
		>
	</a>
</li>
