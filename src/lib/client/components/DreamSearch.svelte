<script lang="ts">
	import * as m from '$lib/paraglide/messages';

	let { initialQuery, onSearch, onReset } = $props<{
		initialQuery: string;
		onSearch: (query: string) => void;
		onReset: () => void;
	}>();

	let searchQuery: string = $state(initialQuery);

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		onSearch(searchQuery);
	}

	function handleReset() {
		searchQuery = '';
		onReset();
	}
</script>

<form onsubmit={handleSubmit}>
	<label class="input-bordered input flex items-center gap-2">
		<input
			type="text"
			class="min-w-10 grow"
			placeholder={m.search_dreams_placeholder()}
			bind:value={searchQuery}
			name="query"
		/>
		<button type="submit" class="btn btn-ghost btn-sm">
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
	</label>
	{#if searchQuery}
		<button type="button" class="btn mt-2 btn-ghost btn-sm" onclick={handleReset}>
			<span aria-label={m.reset_search_button()} class="w-2">
				<svg width="12" height="12">
					<line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2" />
					<line x1="22" y1="2" x2="2" y2="22" stroke="currentColor" stroke-width="2" />
				</svg>
			</span>
		</button>
	{/if}
</form>
