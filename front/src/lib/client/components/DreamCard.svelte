<script lang="ts">
	import { statusTextClass } from '$lib/client/dreamStatus';
	import DreamStatusIcon from './DreamStatusIcon.svelte';
	import { resolve } from '$app/paths';
	import { fade } from 'svelte/transition';
	import * as m from '$lib/paraglide/messages';

	interface Props {
		dream: App.Dream;
	}

	let { dream }: Props = $props();

	// 0: Hidden, 1: Clamped, 2: Full
	let rawTextDisplayState: 0 | 1 | 2 = $state(0); // Default to clamped

	function toggleRawTextDisplay() {
		rawTextDisplayState = ((rawTextDisplayState + 1) % 3) as 0 | 1 | 2;
	}

	const rawTextClass = $derived.by(() => {
		return {
			0: 'hidden', // No text
			1: 'line-clamp-3', // Clamped
			2: '' // Full text
		}[rawTextDisplayState];
	});

	const rawTextTooltip = $derived.by(() => {
		return {
			0: m.show_dream_text(),
			1: m.show_full_dream_text(),
			2: m.hide_dream_text()
		}[rawTextDisplayState];
	});
</script>

<li class="list-row" transition:fade>
	<!-- Status Icon -->
	<div class="flex items-center justify-center {statusTextClass(dream.status)}">
		<DreamStatusIcon status={dream.status} label={dream.status?.replace('_', ' ')} />
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
	<p class={`list-col-wrap text-sm ${rawTextClass}`}>
		{#if rawTextDisplayState !== 0}
			{dream.rawText}
		{/if}
	</p>

	<!-- Toggle Raw Text Button -->
	<button
		type="button"
		class="tooltip btn tooltip-left btn-square btn-ghost"
		data-tip={rawTextTooltip}
		aria-label={rawTextTooltip}
		onclick={toggleRawTextDisplay}
	>
		{#if rawTextDisplayState === 0}
			<!-- Hidden icon (closed eye) -->
			<svg
				class="size-[1.2em]"
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				transition:fade
				><path
					fill="currentColor"
					d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 13c-2.76 0-5-2.24-5-5s2.24-5 5-5s5 2.24 5 5s-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3s3-1.34 3-3s-1.34-3-3-3z"
				/></svg
			>
		{:else if rawTextDisplayState === 1}
			<!-- Clamped icon (open eye) -->
			<svg
				class="size-[1.2em]"
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				transition:fade
				><path
					fill="currentColor"
					d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 13c-2.76 0-5-2.24-5-5s2.24-5 5-5s5 2.24 5 5s-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3s3-1.34 3-3s-1.34-3-3-3z"
				/></svg
			>
		{:else}
			<!-- Full text icon (open eye with lines) -->
			<svg
				class="size-[1.2em]"
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				transition:fade
				><path
					fill="currentColor"
					d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5s5-2.24 5-5s-2.24-5-5-5zm0 8c-1.66 0-3-1.34-3-3s1.34-3 3-3s3 1.34 3 3s-1.34 3-3 3zm-7-1h2v-2H5v2zm12-2h2v2h-2v-2zM3 12c0-2.76 2.24-5 5-5h2V5H8c-3.86 0-7 3.14-7 7s3.14 7 7 7h2v-2H8c-2.76 0-5-2.24-5-5zm18 0c0 2.76-2.24 5-5 5h-2v2h2c3.86 0 7-3.14 7-7s-3.14-7-7-7h-2v2h2c2.76 0 5 2.24 5 5z"
				/></svg
			>
		{/if}
	</button>

	<!-- View Details Button -->
	<a
		href={resolve('/dreams/[id]', { id: dream.id })}
		class="tooltip btn tooltip-left btn-square btn-primary"
		data-tip={m.view_details_button()}
		aria-label={m.aria_go_to_details()}
	>
		<svg class="size-[1.2em]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
			><path fill="currentColor" d="M10 6L8.59 7.41L13.17 12l-4.58 4.59L10 18l6-6z" /></svg
		>
	</a>
</li>
