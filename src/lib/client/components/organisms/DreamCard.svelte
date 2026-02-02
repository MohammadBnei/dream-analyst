<script lang="ts">
	import { fade } from 'svelte/transition';
	import * as m from '$lib/paraglide/messages';
	import StatusIndicator from '../molecules/StatusIndicator.svelte';
	import IconButton from '../molecules/IconButton.svelte';
	import Button from '../atoms/Button.svelte';
	import Icon from '../atoms/Icon.svelte';

	let {
		dream,
		class: className = ''
	}: {
		dream: App.Dream;
		class?: string;
	} = $props();

	type DisplayState = 0 | 1 | 2;
	let rawTextDisplayState: DisplayState = $state(0);

	function toggleRawTextDisplay() {
		rawTextDisplayState = ((rawTextDisplayState + 1) % 3) as DisplayState;
	}

	const rawTextClass = $derived.by(() => {
		return {
			0: 'hidden',
			1: 'line-clamp-3',
			2: ''
		}[rawTextDisplayState];
	});

	const rawTextTooltip = $derived.by(() => {
		return {
			0: m.show_dream_text(),
			1: m.show_full_dream_text(),
			2: m.hide_dream_text()
		}[rawTextDisplayState];
	});

	const eyeIcon = $derived.by(() => {
		const icons = {
			0: 'eye-hidden' as const,
			1: 'eye-peek' as const,
			2: 'eye-full' as const
		};
		return icons[rawTextDisplayState];
	});
</script>

<li class={`list-row ${className}`} transition:fade>
	<div class="flex items-center justify-center">
		<StatusIndicator status={dream.status} />
	</div>

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

	<p class={`list-col-wrap text-sm ${rawTextClass}`}>
		{#if rawTextDisplayState !== 0}
			{dream.rawText}
		{/if}
	</p>

	<button
		class="tooltip btn tooltip-left btn-square btn-ghost"
		data-tip={rawTextTooltip}
		onclick={toggleRawTextDisplay}
	>
		<Icon name={eyeIcon} />
	</button>

	<a
		href={`/dreams/${dream.id}`}
		class="tooltip btn tooltip-left btn-square btn-primary"
		data-tip={m.view_details_button()}
		aria-label="go to details"
	>
		<Icon name="chevron-right" />
	</a>
</li>
