<script lang="ts">
	import { goto } from '$app/navigation';
	import * as m from '$lib/paraglide/messages';

	let {
		dreamId,
		relatedDreams,
		onUpdateRelatedDreams,
		isUpdatingRelatedDreams,
		onRegenerateRelatedDreams,
		isRegeneratingRelatedDreams
	} = $props<{
		dreamId: string;
		relatedDreams: Partial<App.Dream[]>;
		onUpdateRelatedDreams: (updatedRelatedIds: string[]) => Promise<void>;
		isUpdatingRelatedDreams: boolean;
		onRegenerateRelatedDreams: () => Promise<void>;
		isRegeneratingRelatedDreams: boolean;
	}>();

	let isEditing = $state(false);
	let currentRelatedIds = $state<string[]>(relatedDreams.map((d) => d.id || ''));
	let availableDreams = $state<Partial<App.Dream>[]>([]); // For searching and adding

	// Effect to update currentRelatedIds when relatedDreams prop changes
	$effect(() => {
		currentRelatedIds = relatedDreams.map((d) => d.id || '');
	});

	function navigateToDream(id: string) {
		goto(`/dreams/${id}`);
	}

	function handleEditClick() {
		isEditing = true;
		// Optionally fetch all dreams here for selection, or do it on demand
	}

	async function handleSaveClick() {
		await onUpdateRelatedDreams(currentRelatedIds);
		isEditing = false;
	}

	function handleCancelClick() {
		currentRelatedIds = relatedDreams.map((d) => d.id || ''); // Reset to original
		isEditing = false;
	}

	function handleRemoveRelated(idToRemove: string) {
		currentRelatedIds = currentRelatedIds.filter((id) => id !== idToRemove);
	}

	async function handleRegenerateClick() {
		await onRegenerateRelatedDreams();
		isEditing = false; // Exit edit mode after regeneration
	}

	// Placeholder for search functionality (will be implemented later if needed)
	async function searchDreams(query: string) {
		// This would call an API endpoint to search for dreams
		console.log('Searching for dreams:', query);
		// For now, just return an empty array
		return [];
	}
</script>

<div class="mb-6">
	<div class="flex items-center justify-between mb-2">
		<h3 class="text-lg font-semibold">{m.related_dreams_title()}</h3>
		<div class="flex gap-2">
			{#if isEditing}
				<button class="btn btn-sm btn-primary" onclick={handleSaveClick} disabled={isUpdatingRelatedDreams}>
					{#if isUpdatingRelatedDreams}
						<span class="loading loading-spinner loading-sm"></span>
					{:else}
						{m.save_button()}
					{/if}
				</button>
				<button class="btn btn-sm btn-ghost" onclick={handleCancelClick} disabled={isUpdatingRelatedDreams}>
					{m.cancel_button()}
				</button>
			{:else}
				<button class="btn btn-sm btn-outline" onclick={handleEditClick}>
					{m.edit_button()}
				</button>
				<button
					class="btn btn-sm btn-outline"
					onclick={handleRegenerateClick}
					disabled={isRegeneratingRelatedDreams}
				>
					{#if isRegeneratingRelatedDreams}
						<span class="loading loading-spinner loading-sm"></span>
					{:else}
						{m.regenerate_relations_button()}
					{/if}
				</button>
			{/if}
		</div>
	</div>

	{#if relatedDreams && relatedDreams.length > 0}
		<div class="flex flex-wrap gap-2">
			{#each relatedDreams as relatedDream (relatedDream.id)}
				<div class="badge badge-info gap-2 p-3">
					<button class="link" onclick={() => navigateToDream(relatedDream.id || '')}>
						{relatedDream.title ||
							(relatedDream.rawText ? relatedDream.rawText.substring(0, 30) + '...' : 'Untitled')}
					</button>
					{#if isEditing}
						<button class="btn btn-xs btn-circle btn-ghost" onclick={() => handleRemoveRelated(relatedDream.id || '')}>
							✕
						</button>
					{/if}
				</div>
			{/each}
		</div>
	{:else}
		<p class="text-gray-500">{m.no_related_dreams()}</p>
	{/if}

	{#if isEditing}
		<div class="mt-4">
			<h4 class="text-md font-semibold mb-2">{m.add_related_dream_title()}</h4>
			<!-- Placeholder for dream search and add functionality -->
			<input type="text" placeholder={m.search_dreams_placeholder()} class="input input-bordered w-full" />
			<div class="mt-2">
				<!-- Search results would go here -->
				<p class="text-sm text-gray-500">{m.search_dreams_hint()}</p>
			</div>
		</div>
	{/if}
</div>
