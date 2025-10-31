<script lang="ts">
	import * as m from '$lib/paraglide/messages';

	let { initialQuery, currentSortOrder, onSearch, onReset, onSortChange } = $props<{
		initialQuery: string;
		currentSortOrder: 'asc' | 'desc';
		onSearch: (query: string) => void;
		onReset: () => void;
		onSortChange: (order: 'asc' | 'desc') => void;
	}>();

	let searchQuery: string = $state(initialQuery);

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		onSearch(searchQuery);
	}

	function handleSortSelectChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		onSortChange(target.value as 'asc' | 'desc');
	}

	function handleResetClick() {
		searchQuery = '';
		onReset();
	}
</script>

<div class="join-vertical join w-full lg:join-horizontal">
	<select
		class="select-bordered select join-item w-full lg:w-fit"
		onchange={handleSortSelectChange}
		value={currentSortOrder}
	>
		<option value="desc">{m.date_descending_option()}</option>
		<option value="asc">{m.date_ascending_option()}</option>
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
			<button type="submit" class="btn join-item btn-primary">
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
		<button type="button" class="btn join-item" onclick={handleResetClick}>
			<span aria-label={m.reset_search_button()} class="h-4 w-4">
				<svg class="h-auto w-full" viewBox="0 0 24 24">
					<line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2" />
					<line x1="22" y1="2" x2="2" y2="22" stroke="currentColor" stroke-width="2" />
				</svg>
			</span>
		</button>
	{/if}
</div>
