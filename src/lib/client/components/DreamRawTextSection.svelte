<script lang="ts">
	import RichTextInput from '$lib/client/components/RichTextInput.svelte';
	import * as m from '$lib/paraglide/messages';
	import { enhance } from '$app/forms';

	let { rawText, onUpdate } = $props();

	let isEditing = $state(false);
	let editedRawText = $state(rawText);
	let isSavingEdit = $state(false);
	let editError = $state<string | null>(null);

	$effect(() => {
		editedRawText = rawText;
	});

	function toggleEditMode() {
		isEditing = !isEditing;
		if (isEditing) {
			editedRawText = rawText;
			editError = null;
		}
	}

	function handleCancelEdit() {
		isEditing = false;
		editedRawText = rawText;
		editError = null;
	}

	function handleRawTextInput(value: string) {
		editedRawText = value;
	}

	async function handleSubmit({ update }) {
		isSavingEdit = true;
		editError = null;
		await update();
		isSavingEdit = false;
		isEditing = false; // Exit edit mode on success or failure
		onUpdate(); // Notify parent of update attempt
	}
</script>

<div class="mb-6">
	<div class="mb-2 flex items-center justify-between">
		<h3 class="text-lg font-semibold">{m.raw_dream_text_heading()}</h3>
		{#if !isEditing}
			<button onclick={toggleEditMode} class="btn btn-ghost btn-sm">
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
	{#if isEditing}
		<form method="POST" action="?/updateDream" use:enhance={handleSubmit}>
			<RichTextInput
				name="rawText"
				placeholder={m.raw_dream_text_heading()}
				rows={8}
				bind:value={editedRawText}
				onInput={handleRawTextInput}
			/>
			{#if editError}
				<div class="mt-1 text-sm text-error">{editError}</div>
			{/if}
			<div class="mt-2 flex justify-end gap-2">
				<button onclick={handleCancelEdit} type="button" class="btn btn-ghost btn-sm"
					>{m.cancel_button()}</button
				>
				<button
					type="submit"
					class="btn btn-sm btn-primary"
					disabled={isSavingEdit || editedRawText.length < 10}
				>
					{#if isSavingEdit}
						<span class="loading loading-spinner"></span>
						{m.save_button()}
					{:else}
						{m.save_button()}
					{/if}
				</button>
			</div>
		</form>
	{:else}
		<p class="leading-relaxed whitespace-pre-wrap text-base-content/80">
			{rawText}
		</p>
	{/if}
</div>
