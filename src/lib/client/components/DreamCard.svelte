<script lang="ts">
	import { fade } from 'svelte/transition';
	import * as m from '$lib/paraglide/messages';
	import { Streamdown } from 'svelte-streamdown'; // Import Streamdown
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

<div class="collapse-arrow collapse border border-base-300 bg-base-100" transition:fade>
	<input type="checkbox" />
	<div class="collapse-title flex items-center justify-between font-semibold">
		<h2 class="text-lg">
			{m.dream_on_date({ date: new Date(dream.createdAt).toLocaleDateString() })}
		</h2>
		<StatusBadge status={dream.status} />
		<a href={`/dreams/${dream.id}`} class="btn btn-sm btn-primary z-10">{m.view_details_button()}</a>
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
			<div class="prose max-w-none text-sm text-base-content/70 italic">
				<Streamdown content={dream.interpretation} />
			</div>
		{:else if dream.status === 'PENDING_ANALYSIS'}
			<p class="text-sm text-info italic">{m.analysis_pending_message()}</p>
		{:else if dream.status === 'ANALYSIS_FAILED'}
			<p class="text-sm text-error italic">{m.ANALYSIS_FAILED_try_again_message()}</p>
		{/if}
	</div>
</div>
