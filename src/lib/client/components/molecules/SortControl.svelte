<script lang="ts">
	import Select, { type SelectOption } from '../atoms/Select.svelte';

	let {
		sortByValue = $bindable('dreamDate'),
		sortOrderValue = $bindable('desc'),
		sortByOptions,
		onSortChange,
		class: className = ''
	}: {
		sortByValue?: string;
		sortOrderValue?: string;
		sortByOptions: SelectOption[];
		onSortChange?: (sortBy: string, sortOrder: string) => void;
		class?: string;
	} = $props();

	const sortOrderOptions: SelectOption[] = [
		{ value: 'asc', label: 'Ascending' },
		{ value: 'desc', label: 'Descending' }
	];

	function handleChange() {
		onSortChange?.(sortByValue, sortOrderValue);
	}
</script>

<div class={`flex gap-2 ${className}`}>
	<Select
		bind:value={sortByValue}
		options={sortByOptions}
		onchange={handleChange}
		class="flex-1"
	/>
	<Select
		bind:value={sortOrderValue}
		options={sortOrderOptions}
		onchange={handleChange}
		class="flex-1"
	/>
</div>
