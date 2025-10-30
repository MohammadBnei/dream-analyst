<script lang="ts">
	import * as m from '$lib/paraglide/messages';

	let { dreamDate, prevDreamId, nextDreamId } = $props();
</script>

<div class="mb-4 flex items-center justify-between">
	<div class="flex items-center gap-2">
		{#if prevDreamId}
			<a href="/dreams/{prevDreamId}" class="btn btn-sm btn-outline">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M10 19l-7-7m0 0l7-7m-7 7h18"
					/>
				</svg>
				{m.previous_dream_button()}
			</a>
		{/if}
		<h2 class="card-title text-2xl">
			{m.dream_on_date({ date: new Date(dreamDate).toLocaleDateString() })}
		</h2>
		{#if nextDreamId}
			<a href="/dreams/{nextDreamId}" class="btn btn-sm btn-outline">
				{m.next_dream_button()}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M14 5l7 7m0 0l-7 7m7-7H3"
					/>
				</svg>
			</a>
		{/if}
	</div>
	<slot name="status-badge" />
</div>
