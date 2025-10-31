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

<div class="card bg-base-100 shadow-xl" transition:fade>
	<div class="card-body">
		<div class="mb-2 flex items-start justify-between">
			<h2 class="card-title text-lg">
				{m.dream_on_date({ date: new Date(dream.createdAt).toLocaleDateString() })}
			</h2>
			<StatusBadge status={dream.status} />
		</div>

		<p class="mb-4 line-clamp-3 text-sm text-base-content/80">
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
			<p class="line-clamp-3 text-sm text-base-content/70 italic">
				{dream.interpretation}
			</p>
		{:else if dream.status === 'PENDING_ANALYSIS'}
			<p class="text-sm text-info italic">{m.analysis_pending_message()}</p>
		{:else if dream.status === 'ANALYSIS_FAILED'}
			<p class="text-sm text-error italic">{m.ANALYSIS_FAILED_try_again_message()}</p>
		{/if}

		<div class="mt-4 card-actions justify-end">
			<a href={`/dreams/${dream.id}`} class="btn btn-sm btn-primary"
				>{m.view_details_button()}</a
			>
		</div>
	</div>
</div>
