<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import Button from '../atoms/Button.svelte';

	let {
		currentPage,
		totalPages,
		onPageChange,
		totalItems = 0,
		pageSize = 10,
		showRange = true,
		class: className = ''
	}: {
		currentPage: number;
		totalPages: number;
		onPageChange: (page: number) => void;
		totalItems?: number;
		pageSize?: number;
		showRange?: boolean;
		class?: string;
	} = $props();

	const pageNumbers = $derived.by(() => {
		const pages = [];
		const maxPagesToShow = 5;
		let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
		let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

		if (endPage - startPage + 1 < maxPagesToShow) {
			startPage = Math.max(1, endPage - maxPagesToShow + 1);
		}

		for (let i = startPage; i <= endPage; i++) {
			pages.push(i);
		}
		return pages;
	});

	const startItem = $derived((currentPage - 1) * pageSize + 1);
	const endItem = $derived(Math.min(currentPage * pageSize, totalItems));
</script>

{#if totalItems > 0}
	<div class={`flex flex-col items-center gap-4 ${className}`}>
		{#if showRange}
			<div class="text-sm text-base-content/70">
				{m.showing_range_of_dreams({ start: startItem, end: endItem, total: totalItems })}
			</div>
		{/if}

		<div class="join">
			<Button
				variant="ghost"
				class="join-item"
				disabled={currentPage === 1}
				onclick={() => onPageChange(currentPage - 1)}
			>
				{m.previous_button()}
			</Button>

			{#if pageNumbers[0] > 1}
				<Button variant="ghost" class="join-item" onclick={() => onPageChange(1)}>1</Button>
				{#if pageNumbers[0] > 2}
					<button class="btn btn-disabled join-item">...</button>
				{/if}
			{/if}

			{#each pageNumbers as pageNum}
				<Button
					variant={currentPage === pageNum ? 'primary' : 'ghost'}
					class="join-item"
					onclick={() => onPageChange(pageNum)}
				>
					{pageNum}
				</Button>
			{/each}

			{#if pageNumbers[pageNumbers.length - 1] < totalPages}
				{#if pageNumbers[pageNumbers.length - 1] < totalPages - 1}
					<button class="btn btn-disabled join-item">...</button>
				{/if}
				<Button variant="ghost" class="join-item" onclick={() => onPageChange(totalPages)}>
					{totalPages}
				</Button>
			{/if}

			<Button
				variant="ghost"
				class="join-item"
				disabled={currentPage === totalPages}
				onclick={() => onPageChange(currentPage + 1)}
			>
				{m.next_button()}
			</Button>
		</div>
	</div>
{/if}
