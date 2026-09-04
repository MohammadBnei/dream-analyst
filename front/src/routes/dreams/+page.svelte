<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import DreamCard from '$lib/client/components/DreamCard.svelte';
	import DreamPagination from '$lib/client/components/DreamPagination.svelte';
	import DreamSearchAndSort from '$lib/client/components/DreamSearchAndSort.svelte';
	import VocabularyStrip from '$lib/client/components/VocabularyStrip.svelte';
	import NoDreamsMessage from '$lib/client/components/NoDreamsMessage.svelte';
	import * as m from '$lib/paraglide/messages';

	// Data loaded from +page.server.ts
	let { data } = $props();

	let dreams = $derived(data.dreams);
	let currentPage = $derived(data.currentPage);
	let totalPages = $derived(data.totalPages);
	let totalDreams = $derived(data.totalDreams);
	let sortOrder = $derived(data.sortOrder as 'asc' | 'desc');
	let sortBy = $derived(data.sortBy || 'dreamDate'); // New: Get sortBy from data, default to 'dreamDate'
	let pageSize = $derived(data.pageSize); // Get pageSize from data

	let vocabulary = $derived(data.vocabulary ?? []);
	let activeElement = $derived(data.activeElement ?? null);

	// Mirrors the URL rather than holding its own copy. It used to be $state
	// initialised once, which was safe only while every navigation went through
	// updateUrl. The symbol badges navigate directly, so a stale term would sit in
	// the box and get written back on the next pagination click, silently
	// collapsing the result set. svelte-check flagged this line already.
	let searchQuery = $derived(data.query || '');

	// Function to update URL with new query parameters
	// The symbol facet is carried EXPLICITLY, as another argument with a default,
	// rather than by seeding params from the current URL. Seeding looks shorter
	// but makes every parameter sticky, and since each `set` below sits behind a
	// truthiness guard with no matching `delete`, it would silently break reset:
	// handleResetSearch passes '' for the query, the guard is false, and the old
	// search term would survive forever.
	async function updateUrl(
		newQuery: string = searchQuery,
		newPage: number = currentPage,
		newSortBy: 'dreamDate' | 'title' = sortBy,
		newSortOrder: 'asc' | 'desc' = sortOrder,
		newElement: string | null = activeElement?.id ?? null
	) {
		// Local throwaway used to build a URL, not reactive state.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const params = new URLSearchParams();
		if (newQuery) params.set('query', newQuery);
		if (newPage !== 1) params.set('page', String(newPage));
		if (newSortBy !== 'dreamDate') params.set('sortBy', newSortBy); // Only set if not default 'dreamDate'
		if (newSortOrder !== 'desc') params.set('sortOrder', newSortOrder); // Only set if not default 'desc'
		if (newElement) params.set('element', newElement);
		const query = params.toString();
		// Search-only navigation on the current route: there is no pathname to
		// rewrite, so resolve() would add nothing. The rule only accepts a literal
		// resolve() call as the argument, hence the scoped exception.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		await goto(query ? `?${query}` : '?');
	}

	async function handleSearch(query: string) {
		// No local assignment: updateUrl navigates, `data.query` changes, and
		// searchQuery re-derives. Writing to a $derived is forbidden anyway.
		await updateUrl(query, 1, sortBy, sortOrder); // Reset to page 1 on new search
	}

	function handleResetSearch() {
		updateUrl('', 1, 'dreamDate', 'desc'); // Reset to page 1, default sort
	}

	async function handlePageChange(page: number) {
		await updateUrl(searchQuery, page, sortBy, sortOrder);
	}

	async function handleSortChange(newSortBy: 'dreamDate' | 'title', newSortOrder: 'asc' | 'desc') {
		await updateUrl(searchQuery, 1, newSortBy, newSortOrder); // Reset to page 1 on sort change
	}

	// Deliberately independent of handleResetSearch: clearing a text search should
	// not silently drop the symbol the user is browsing, and vice versa.
	async function clearElementFilter() {
		await updateUrl(searchQuery, 1, sortBy, sortOrder, null);
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

<div class="container mx-auto max-w-4xl md:p-4">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-3xl font-bold">{m.your_dreams_title()}</h1>
		<a href={resolve('/dreams/new')} class="btn btn-primary">{m.add_new_dream_button()}</a>
	</div>

	<div class="mb-6">
		<VocabularyStrip {vocabulary} {activeElement} onClear={clearElementFilter} />

		<DreamSearchAndSort
			initialQuery={data.query || ''}
			currentSortOrder={sortOrder as 'asc' | 'desc'}
			currentSortBy={sortBy as 'dreamDate' | 'title'}
			onSearch={handleSearch}
			onReset={handleResetSearch}
			onSortChange={handleSortChange}
		/>
	</div>

	{#if dreams.length === 0}
		<NoDreamsMessage />
	{:else}
		<ul class="list rounded-box bg-base-100 shadow-md">
			{#each dreams as dream (dream.id)}
				<DreamCard {dream} />
			{/each}
		</ul>

		<div class="mt-8 flex justify-center">
			<DreamPagination
				{currentPage}
				{totalPages}
				onPageChange={handlePageChange}
				{totalDreams}
				{pageSize}
			/>
		</div>
	{/if}
</div>
