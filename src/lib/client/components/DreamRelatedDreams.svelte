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
	<div class="mb-2 flex items-center justify-between">
		<h3 class="text-lg font-semibold">{m.related_dreams_title()}</h3>
		<div class="flex gap-2">
			{#if isEditing}
				<button
					class="btn btn-sm btn-primary"
					onclick={handleSaveClick}
					disabled={isUpdatingRelatedDreams}
				>
					{#if isUpdatingRelatedDreams}
						<span class="loading loading-sm loading-spinner"></span>
					{:else}
						{m.save_button()}
					{/if}
				</button>
				<button
					class="btn btn-ghost btn-sm"
					onclick={handleCancelClick}
					disabled={isUpdatingRelatedDreams}
				>
					{m.cancel_button()}
				</button>
			{:else}
				<button class="btn btn-outline btn-sm" onclick={handleEditClick} aria-label="edit related dreams">
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
				</button>
				<button
					class="btn btn-outline btn-sm"
					onclick={handleRegenerateClick}
					disabled={isRegeneratingRelatedDreams}
				>
					{#if isRegeneratingRelatedDreams}
						<span class="loading loading-sm loading-spinner"></span>
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
				<div class="badge gap-2 p-3 badge-info">
					<button class="link" onclick={() => navigateToDream(relatedDream.id || '')}>
						{relatedDream.title ||
							(relatedDream.rawText ? relatedDream.rawText.substring(0, 30) + '...' : 'Untitled')}
					</button>
					{#if isEditing}
						<button
							class="btn btn-circle btn-ghost btn-xs"
							onclick={() => handleRemoveRelated(relatedDream.id || '')}
						>
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
			<h4 class="text-md mb-2 font-semibold">{m.add_related_dream_title()}</h4>
			<!-- Placeholder for dream search and add functionality -->
			<input
				type="text"
				placeholder={m.search_dreams_placeholder()}
				class="input-bordered input w-full"
			/>
			<div class="mt-2">
				<!-- Search results would go here -->
				<p class="text-sm text-gray-500">{m.search_dreams_hint()}</p>
			</div>
		</div>
	{/if}
</div>
