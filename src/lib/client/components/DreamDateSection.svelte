<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { enhance } from '$app/forms';

	let { dreamDate, onUpdate } = $props();

	let isEditingDreamDate = $state(false);
	let editedDreamDate = $state(dreamDate ? new Date(dreamDate).toISOString().split('T')[0] : '');
	let isSavingDreamDate = $state(false);
	let dreamDateEditError = $state<string | null>(null);

	$effect(() => {
		editedDreamDate = dreamDate ? new Date(dreamDate).toISOString().split('T')[0] : '';
	});

	function toggleDreamDateEditMode() {
		isEditingDreamDate = !isEditingDreamDate;
		if (isEditingDreamDate) {
			editedDreamDate = dreamDate ? new Date(dreamDate).toISOString().split('T')[0] : '';
			dreamDateEditError = null;
		}
	}

	function handleCancelDreamDateEdit() {
		isEditingDreamDate = false;
		editedDreamDate = dreamDate ? new Date(dreamDate).toISOString().split('T')[0] : '';
		dreamDateEditError = null;
	}

	function handleDreamDateInput(event: Event) {
		editedDreamDate = (event.target as HTMLInputElement).value;
	}

	async function handleSubmit({ update }) {
		isSavingDreamDate = true;
		dreamDateEditError = null;
		await update();
		isSavingDreamDate = false;
		isEditingDreamDate = false; // Exit edit mode on success or failure
		onUpdate(); // Notify parent of update attempt
	}
</script>

<div class="mb-6">
	<div class="mb-2 flex items-center justify-between">
		<h3 class="font-semibold">{m.dream_date_label()} {new Date(dreamDate).toLocaleDateString()}</h3>
		{#if !isEditingDreamDate}
			<button onclick={toggleDreamDateEditMode} class="btn btn-ghost btn-sm">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
					/>
				</svg>
				{m.edit_button()}
			</button>
		{/if}
	</div>
	{#if isEditingDreamDate}
		<form method="POST" action="?/updateDreamDate" use:enhance={handleSubmit}>
			<input
				type="date"
				name="dreamDate"
				class="input-bordered input w-fit"
				bind:value={editedDreamDate}
				oninput={handleDreamDateInput}
			/>
			{#if dreamDateEditError}
				<div class="mt-1 text-sm text-error">{dreamDateEditError}</div>
			{/if}
			<div class="mt-2 flex justify-end gap-2">
				<button onclick={handleCancelDreamDateEdit} type="button" class="btn btn-ghost btn-sm"
					>{m.cancel_button()}</button
				>
				<button type="submit" class="btn btn-sm btn-primary" disabled={isSavingDreamDate}>
					{#if isSavingDreamDate}
						<span class="loading loading-spinner"></span>
						{m.save_button()}
					{:else}
						{m.save_button()}
					{/if}
				</button>
			</div>
		</form>
	{/if}
</div>
