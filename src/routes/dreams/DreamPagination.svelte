<script lang="ts">
	import * as m from '$lib/paraglide/messages';

	let { currentPage, totalPages, onPageChange, totalDreams, pageSize } = $props<{
		currentPage: number;
		totalPages: number;
		onPageChange: (page: number) => void;
		totalDreams: number;
		pageSize: number; // New prop
	}>();

	// Generate an array of page numbers to display
	const pageNumbers = $derived(() => {
		const pages = [];
		const maxPagesToShow = 5; // Number of page buttons to show
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

	const startDream = $derived(() => (currentPage - 1) * pageSize + 1);
	const endDream = $derived(() => Math.min(currentPage * pageSize, totalDreams));
</script>

{#if totalDreams > 0}
	<div class="flex flex-col items-center gap-4">
		<div class="text-sm text-base-content/70">
			{m.showing_range_of_dreams({ start: startDream, end: endDream, total: totalDreams })}
		</div>
		<div class="join">
			<button
				class="btn join-item"
				disabled={currentPage === 1}
				onclick={() => onPageChange(currentPage - 1)}
			>
				{m.previous_button()}
			</button>

			{#if pageNumbers[0] > 1}
				<button class="btn join-item" onclick={() => onPageChange(1)}>1</button>
				{#if pageNumbers[0] > 2}
					<button class="btn join-item btn-disabled">...</button>
				{/if}
			{/if}

			{#each pageNumbers as pageNum}
				<button
					class="btn join-item {currentPage === pageNum ? 'btn-active' : ''}"
					onclick={() => onPageChange(pageNum)}
				>
					{pageNum}
				</button>
			{/each}

			{#if pageNumbers[pageNumbers.length - 1] < totalPages}
				{#if pageNumbers[pageNumbers.length - 1] < totalPages - 1}
					<button class="btn join-item btn-disabled">...</button>
				{/if}
				<button class="btn join-item" onclick={() => onPageChange(totalPages)}>{totalPages}</button>
			{/if}

			<button
				class="btn join-item"
				disabled={currentPage === totalPages}
				onclick={() => onPageChange(currentPage + 1)}
			>
				{m.next_button()}
			</button>
		</div>
	</div>
{/if}
