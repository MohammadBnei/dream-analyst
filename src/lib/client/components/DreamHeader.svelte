<script lang="ts">
	import * as m from '$lib/paraglide/messages';

	let { dreamStatus, onDeleteClick } = $props();
</script>

<div class="mb-6 flex w-full flex-col items-center justify-between">
	<h1 class="grow text-center text-3xl font-bold">{m.dream_details_title()}</h1>
	<div class="mt-2 flex w-full justify-between">
		<a href="/dreams" class="btn btn-ghost">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-5 w-5"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
			{m.back_to_dreams_button()}
		</a>
		<div class="w-24 text-right">
			<button
				onclick={onDeleteClick}
				class="btn btn-sm btn-error"
				class:hidden={dreamStatus === 'PENDING_ANALYSIS'}
			>
				{m.delete_dream_button()}
			</button>
		</div>
	</div>
</div>
