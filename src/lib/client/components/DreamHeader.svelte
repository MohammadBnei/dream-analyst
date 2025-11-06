<script lang="ts">
	import * as m from '$lib/paraglide/messages';

	let { dreamStatus, onDeleteClick, dreamTitle, onRegenerateTitle, isRegeneratingTitle } = $props();
</script>

<div class="mb-6 flex w-full flex-col items-center justify-between">
	<h1 class="grow text-center text-3xl font-bold">
		{#if dreamTitle}
			{dreamTitle}
		{:else}
			{m.dream_details_title()}
		{/if}
		<button
			class="btn btn-ghost btn-sm ml-2"
			onclick={onRegenerateTitle}
			disabled={isRegeneratingTitle || dreamStatus === 'PENDING_ANALYSIS'}
		>
			{#if isRegeneratingTitle}
				<span class="loading loading-spinner loading-sm"></span>
			{:else}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="h-5 w-5"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.181m0 0 9.54-9.541m-9.54 9.54H12a2.25 2.25 0 0 0 2.25-2.25V12a2.25 2.25 0 0 0-2.25-2.25H9c-1.03 0-1.9.693-2.165 1.731m0 0 3.181 3.181M12 5.25V3m0 18v-2.25M21 12h-2.25M3 12H5.25m15.403-9.403L17.58 7.21M3.393 3.393 7.21 7.21m11.384 8.614 2.916 2.916m-2.916-2.916A11.952 11.952 0 0 0 12 21c-2.31 0-4.516-.657-6.418-1.823M11.25 4.721A11.952 11.952 0 0 1 12 3c2.31 0 4.516.657 6.418 1.823"
					/>
				</svg>
			{/if}
		</button>
	</h1>
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
