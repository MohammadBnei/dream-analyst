<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { enhance } from '$app/forms'; // Import enhance

	let { dreamStatus, onDeleteClick, dreamTitle, onRegenerateTitle, isRegeneratingTitle } = $props();

	let isEditingTitle = $state(false);
	let editedTitle = $state(dreamTitle || '');
	let isUpdatingTitle = $state(false); // Local state for form submission loading

	// Effect to synchronize editedTitle with dreamTitle prop when not editing
	$effect(() => {
		// Only update editedTitle from dreamTitle if we are NOT in editing mode.
		// This allows the user to type freely when isEditingTitle is true.
		if (!isEditingTitle) {
			editedTitle = dreamTitle || '';
		}
	});

	function handleEditClick() {
		isEditingTitle = true;
		editedTitle = dreamTitle || ''; // Ensure editedTitle starts with the current dreamTitle when entering edit mode
	}

	function handleCancelClick() {
		editedTitle = dreamTitle || ''; // Reset to original title
		isEditingTitle = false;
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			handleCancelClick();
		}
		// Enter key submission is handled by the form's default behavior
	}

	// Function to be used with use:enhance
	async function handleSubmit({ update }) {
		isUpdatingTitle = true;
		await update(); // This will trigger the form action and invalidate
		isUpdatingTitle = false;
		isEditingTitle = false; // Exit edit mode after update attempt
	}
</script>

<div class="mb-6 flex w-full flex-col items-center justify-between">
	<div class="flex items-center justify-center gap-2">
		{#if isEditingTitle}
			<form method="POST" action="?/updateTitle" use:enhance={() => handleSubmit} class="flex items-center gap-2">
				<input
					type="text"
					name="title"
					class="input input-lg w-full input-ghost text-center text-3xl font-bold"
					bind:value={editedTitle}
					onkeydown={handleKeyDown}
					disabled={isUpdatingTitle}
				/>
				<button type="submit" class="btn btn-ghost btn-sm" disabled={isUpdatingTitle}>
					{#if isUpdatingTitle}
						<span class="loading loading-sm loading-spinner"></span>
					{:else}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
							class="h-5 w-5"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"></path>
						</svg>
					{/if}
				</button>
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					onclick={handleCancelClick}
					disabled={isUpdatingTitle}
					aria-label="cancel title edit"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						class="h-5 w-5"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path>
					</svg>
				</button>
			</form>
		{:else}
			<h1 class="grow text-center text-3xl font-bold">
				{#if dreamTitle}
					{dreamTitle}
				{:else}
					{m.dream_details_title()}
				{/if}
			</h1>
			<button class="btn ml-2 btn-ghost btn-sm" onclick={handleEditClick} aria-label="edit title">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="h-5 w-5"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
					></path>
				</svg>
			</button>
			<button
				class="btn btn-ghost btn-sm"
				onclick={onRegenerateTitle}
				disabled={isRegeneratingTitle || dreamStatus === 'PENDING_ANALYSIS'}
			>
				{#if isRegeneratingTitle}
					<span class="loading loading-sm loading-spinner"></span>
				{:else}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						class="h-5 w-5"
					>
						<path d="M15.5 13a3.5 3.5 0 0 0 -3.5 3.5v1a3.5 3.5 0 0 0 7 0v-1.8" />
						<path d="M8.5 13a3.5 3.5 0 0 1 3.5 3.5v1a3.5 3.5 0 0 1 -7 0v-1.8" />
						<path d="M17.5 16a3.5 3.5 0 0 0 0 -7h-.5" />
						<path d="M19 9.3v-2.8a3.5 3.5 0 0 0 -7 0" />
						<path d="M6.5 16a3.5 3.5 0 0 1 0 -7h.5" />
						<path d="M5 9.3v-2.8a3.5 3.5 0 0 1 7 0v10" />
					</svg>
				{/if}
			</button>
		{/if}
	</div>
	<div class="mt-2 flex w-full justify-between">
		<a href="/dreams" class="btn btn-ghost">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-5 w-5"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
			{m.back_to_dreams_button()}
		</a>
		<div class="w-24 text-right">
			<button
				onclick={onDeleteClick}
				class="btn btn-sm btn-error"
				class:hidden={dreamStatus === 'PENDING_ANALYSIS'}
			>
				{m.delete_dream_button()}
			</button>
		</div>
	</div>
</div>
