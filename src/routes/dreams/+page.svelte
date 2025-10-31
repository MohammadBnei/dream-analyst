<script lang="ts">
	import { invalidateAll, goto } from '$app/navigation';
	import * as m from '$lib/paraglide/messages';
	import DreamSearch from './DreamSearch.svelte';
	import NoDreamsMessage from './NoDreamsMessage.svelte';
	import DreamCard from './DreamCard.svelte';
	import ErrorMessage from './ErrorMessage.svelte';
	import DreamPagination from './DreamPagination.svelte'; // New component
	import DreamSort from './DreamSort.svelte'; // New component

	// Data loaded from +page.server.ts
	let { data, form } = $props();

	let dreams = $derived(data.dreams);
	let currentPage = $derived(data.currentPage);
	let totalPages = $derived(data.totalPages);
	let totalDreams = $derived(data.totalDreams);
	let sortOrder = $derived(data.sortOrder);

	let clientError: string | null = $state(null);
	let searchQuery: string = $state(data.query || '');

	// Handle form action responses
	$effect(() => {
		if (form?.success) {
			invalidateAll();
		}
		if (form?.error) {
			console.error('Form action error:', form.error);
			clientError = form.error;
		}
	});

	// Function to update URL with new query parameters
	async function updateUrl(
		newQuery: string = searchQuery,
		newPage: number = currentPage,
		newSortOrder: string = sortOrder
	) {
		const params = new URLSearchParams();
		if (newQuery) params.set('query', newQuery);
		if (newPage !== 1) params.set('page', String(newPage));
		if (newSortOrder !== 'desc') params.set('sortOrder', newSortOrder); // Only set if not default 'desc'
		await goto(`?${params.toString()}`);
	}

	async function handleSearch(query: string) {
		searchQuery = query;
		await updateUrl(query, 1, sortOrder); // Reset to page 1 on new search
	}

	function handleResetSearch() {
		searchQuery = '';
		updateUrl('', 1, sortOrder); // Reset to page 1 on reset
	}

	async function handlePageChange(page: number) {
		await updateUrl(searchQuery, page, sortOrder);
	}

	async function handleSortChange(order: 'asc' | 'desc') {
		await updateUrl(searchQuery, 1, order); // Reset to page 1 on sort change
	}
</script>

<svelte:head>
	<title>{m.your_dreams_title()} - {m.app_name()}</title>
	<meta name="description" content={m.dreams_page_description()} />
	<!-- Open Graph / Facebook -->
	<meta property="og:title" content={m.your_dreams_title()} />
	<meta property="og:description" content={m.dreams_page_description()} />
	<!-- Twitter -->
	<meta property="twitter:title" content={m.your_dreams_title()} />
	<meta property="twitter:description" content={m.dreams_page_description()} />
</svelte:head>

<div class="container mx-auto max-w-4xl p-4">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-3xl font-bold">{m.your_dreams_title()}</h1>
		<a href="/dreams/new" class="btn btn-primary">{m.add_new_dream_button()}</a>
	</div>

	<div class="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
		<div class="flex-grow">
			<DreamSearch
				initialQuery={data.query || ''}
				onSearch={handleSearch}
				onReset={handleResetSearch}
			/>
		</div>
		<DreamSort currentSortOrder={sortOrder} onSortChange={handleSortChange} />
	</div>

	<ErrorMessage bind:clientError />

	{#if dreams.length === 0}
		<NoDreamsMessage />
	{:else}
		<div class="join join-vertical w-full">
			{#each dreams as dream (dream.id)}
				<DreamCard {dream} />
			{/each}
		</div>

		<div class="mt-8 flex justify-center">
			<DreamPagination
				{currentPage}
				{totalPages}
				onPageChange={handlePageChange}
				{totalDreams}
			/>
		</div>
	{/if}
</div>
