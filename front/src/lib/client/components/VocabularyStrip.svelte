<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages';
	import { elementKindBadge } from '$lib/client/elementKindStyle';

	type Entry = { id: string; kind: string; label: string; count: number };

	let {
		vocabulary = [],
		activeElement = null,
		onClear
	} = $props<{
		vocabulary?: Entry[];
		activeElement?: { id: string; label: string } | null;
		onClear: () => void;
	}>();
</script>

{#if vocabulary.length || activeElement}
	<section class="mb-4" aria-label={m.vocabulary_heading()}>
		<div class="mb-2 flex flex-wrap items-center gap-2">
			<h2 class="text-sm font-medium text-base-content/70">{m.vocabulary_heading()}</h2>
			{#if activeElement}
				<button type="button" class="badge gap-1 badge-neutral" onclick={onClear}>
					{m.filtered_by_element({ label: activeElement.label })}
					<span aria-hidden="true">✕</span>
					<span class="sr-only">{m.clear_element_filter()}</span>
				</button>
			{/if}
		</div>

		<div class="flex flex-wrap gap-2">
			{#each vocabulary as entry (entry.id)}
				<a
					class="badge {elementKindBadge(entry.kind)} gap-1"
					class:badge-outline={entry.id !== activeElement?.id}
					href={resolve(`/dreams?element=${entry.id}`)}
					aria-label={m.filter_by_element({ label: entry.label })}
					aria-current={entry.id === activeElement?.id ? 'true' : undefined}
				>
					{entry.label}
					<span class="opacity-70">×{entry.count}</span>
				</a>
			{/each}
		</div>
	</section>
{/if}
