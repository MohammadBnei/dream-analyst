<script lang="ts">
	import * as m from '$lib/paraglide/messages';

	let { initialQuery, currentSortOrder, onSearch, onReset, onSortChange, currentSortBy } = $props<{
		initialQuery: string;
		currentSortOrder: 'asc' | 'desc';
		currentSortBy: 'dreamDate' | 'title'; // New prop for current sort by field
		onSearch: (query: string) => void;
		onReset: () => void;
		onSortChange: (sortBy: 'dreamDate' | 'title', sortOrder: 'asc' | 'desc') => void;
	}>();

	let searchQuery: string = $state(initialQuery);
	let sortBy: 'dreamDate' | 'title' = $state(currentSortBy); // State for sort by field
	let sortOrder: 'asc' | 'desc' = $state(currentSortOrder); // State for sort order

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		onSearch(searchQuery);
	}

	function handleSortByChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		sortBy = target.value as 'dreamDate' | 'title';
		onSortChange(sortBy, sortOrder);
	}

	function handleSortOrderChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		sortOrder = target.value as 'asc' | 'desc';
		onSortChange(sortBy, sortOrder);
	}

	function handleResetClick() {
		searchQuery = '';
		onReset();
	}
</script>

<div class="join-vertical join w-full lg:join-horizontal">
	<!-- Sort By Field -->
	<select
		class="select-bordered select join-item w-full lg:w-fit"
		onchange={handleSortByChange}
		value={sortBy}
	>
		<option value="dreamDate">{m.sort_by_date()}</option>
		<option value="title">{m.sort_by_title()}</option>
	</select>

	<!-- Sort Order -->
	<select
		class="select-bordered select join-item w-full lg:w-fit"
		onchange={handleSortOrderChange}
		value={sortOrder}
	>
		<option value="desc">{m.descending_option()}</option>
		<option value="asc">{m.ascending_option()}</option>
	</select>

	<div class="grow">
		<form onsubmit={handleSubmit} class="flex h-full">
			<input
				type="text"
				class="input-bordered input join-item grow"
				placeholder={m.search_dreams_placeholder()}
				bind:value={searchQuery}
				name="query"
			/>
			<button type="submit" class="btn join-item btn-primary" aria-label="submit">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 16 16"
					fill="currentColor"
					class="h-4 w-4 opacity-70"
					><path
						fill-rule="evenodd"
						d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"
						clip-rule="evenodd"
					></path></svg
				>
			</button>
		</form>
	</div>

	{#if searchQuery}
		<button
			type="button"
			class="btn join-item"
			onclick={handleResetClick}
			aria-label={m.reset_search_button()}
		>
			<span aria-label={m.reset_search_button()} class="h-4 w-4">
				<svg class="h-auto w-full" viewBox="0 0 24 24">
					<line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2" />
					<line x1="22" y1="2" x2="2" y2="22" stroke="currentColor" stroke-width="2" />
				</svg>
			</span>
		</button>
	{/if}
</div>
