<script lang="ts">
	import { goto } from '$app/navigation';

	let { relatedDreams } = $props<{ relatedDreams: App.Dream[] }>();

	function navigateToDream(dreamId: string) {
		goto(`/dreams/${dreamId}`);
	}
</script>

{#if relatedDreams && relatedDreams.length > 0}
	<div class="mb-6">
		<h3 class="text-lg font-semibold mb-2">Related Dreams</h3>
		<div class="flex flex-wrap gap-2">
			{#each relatedDreams as relatedDream (relatedDream.id)}
				<button
					class="btn btn-sm btn-outline btn-info"
					onclick={() => navigateToDream(relatedDream.id)}
				>
					{relatedDream.dreamDate ? new Date(relatedDream.dreamDate).toLocaleDateString() : 'No Date'}
					- {relatedDream.rawText.substring(0, 30)}...
				</button>
			{/each}
		</div>
	</div>
{/if}
