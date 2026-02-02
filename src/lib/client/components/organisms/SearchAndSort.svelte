<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import SearchBar from '../molecules/SearchBar.svelte';
	import SortControl from '../molecules/SortControl.svelte';
	import type { SelectOption } from '../atoms/Select.svelte';

	let {
		searchValue = $bindable(''),
		sortByValue = $bindable('dreamDate'),
		sortOrderValue = $bindable('desc'),
		sortByOptions,
		onSearch,
		onReset,
		onSortChange,
		class: className = ''
	}: {
		searchValue?: string;
		sortByValue?: string;
		sortOrderValue?: string;
		sortByOptions: SelectOption[];
		onSearch?: (query: string) => void;
		onReset?: () => void;
		onSortChange?: (sortBy: string, sortOrder: string) => void;
		class?: string;
	} = $props();

	function handleSearch(query: string) {
		searchValue = query;
		onSearch?.(query);
	}

	function handleReset() {
		searchValue = '';
		onReset?.();
	}

	function handleSortChange(sortBy: string, sortOrder: string) {
		sortByValue = sortBy;
		sortOrderValue = sortOrder;
		onSortChange?.(sortBy, sortOrder);
	}
</script>

<div class={`flex w-full flex-col gap-2 lg:flex-row lg:items-center ${className}`}>
	<SortControl
		bind:sortByValue
		bind:sortOrderValue
		{sortByOptions}
		onSortChange={handleSortChange}
		class="w-full lg:w-fit"
	/>

	<SearchBar
		bind:value={searchValue}
		placeholder={m.search_dreams_placeholder()}
		onSearch={handleSearch}
		onReset={handleReset}
		class="flex-1"
	/>
</div>
