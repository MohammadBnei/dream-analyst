<script lang="ts">
	import { fade } from 'svelte/transition';
	import * as m from '$lib/paraglide/messages';
	import StatusBadge from './StatusBadge.svelte';

	let { dream } = $props<{
		dream: {
			id: string;
			createdAt: string;
			rawText: string;
			tags?: string[];
			interpretation?: string;
			status: 'COMPLETED' | 'PENDING_ANALYSIS' | 'ANALYSIS_FAILED' | string;
		};
	}>();
</script>

<div class="collapse collapse-arrow join-item border border-base-300 bg-base-100" transition:fade>
	<input type="radio" name="dream-accordion-{dream.id}" />
	<div class="collapse-title flex items-center justify-between font-semibold">
		<h2 class="text-lg">
			{m.dream_on_date({ date: new Date(dream.createdAt).toLocaleDateString() })}
		</h2>
		<StatusBadge status={dream.status} />
	</div>
	<div class="collapse-content">
		<p class="mb-4 text-sm text-base-content/80">
			{dream.rawText}
		</p>

		{#if dream.tags && dream.tags.length > 0}
			<div class="mb-4 flex flex-wrap gap-2">
				{#each dream.tags as tag}
					<span class="badge badge-outline badge-sm">{tag}</span>
				{/each}
			</div>
		{/if}

		{#if dream.interpretation}
			<p class="text-sm text-base-content/70 italic">
				{dream.interpretation}
			</p>
		{:else if dream.status === 'PENDING_ANALYSIS'}
			<p class="text-sm text-info italic">{m.analysis_pending_message()}</p>
		{:else if dream.status === 'ANALYSIS_FAILED'}
			<p class="text-sm text-error italic">{m.ANALYSIS_FAILED_try_again_message()}</p>
		{/if}

		<div class="mt-4 flex justify-end">
			<a href={`/dreams/${dream.id}`} class="btn btn-sm btn-primary"
				>{m.view_details_button()}</a
			>
		</div>
	</div>
</div>
