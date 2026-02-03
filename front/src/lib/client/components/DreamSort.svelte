<script lang="ts">
	import * as m from '$lib/paraglide/messages';

	let { currentSortOrder, onSortChange } = $props<{
		currentSortOrder: 'asc' | 'desc';
		onSortChange: (order: 'asc' | 'desc') => void;
	}>();

	function handleSelectChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		onSortChange(target.value as 'asc' | 'desc');
	}
</script>

<div class="form-control">
	<label for="sortOrder" class="label">
		<span class="label-text">{m.sort_by_label()}</span>
	</label>
	<select
		id="sortOrder"
		class="select-bordered select"
		onchange={handleSelectChange}
		value={currentSortOrder}
	>
		<option value="desc">{m.date_descending_option()}</option>
		<option value="asc">{m.date_ascending_option()}</option>
	</select>
</div>
