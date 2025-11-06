<script lang="ts">
	import { goto } from '$app/navigation';
	import * as m from '$lib/paraglide/messages';
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	let {
		dreamId,
		relatedDreams,
		onUpdateRelatedDreams, // This will now be handled by form actions internally
		isUpdatingRelatedDreams,
		onRegenerateRelatedDreams, // This will now be handled by form actions internally
		isRegeneratingRelatedDreams
	} = $props<{
		dreamId: string;
		relatedDreams: Partial<App.Dream[]>;
		onUpdateRelatedDreams: (updatedRelatedIds: string[]) => Promise<void>; // Keep for now, but will be replaced
		isUpdatingRelatedDreams: boolean;
		onRegenerateRelatedDreams: () => Promise<void>; // Keep for now, but will be replaced
		isRegeneratingRelatedDreams: boolean;
	}>();

	let isEditing = $state(false);
	let currentRelatedIds = $state<string[]>(relatedDreams.map((d) => d.id || ''));
	let availableDreams = $state<Partial<App.Dream>[]>([]); // For searching and adding
	let searchQuery = $state('');
	let searchResults = $state<Partial<App.Dream>[]>([]);
	let isSearching = $state(false);
	let searchTimeout: ReturnType<typeof setTimeout>;

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
		// This will now be handled by the form action
		// await onUpdateRelatedDreams(currentRelatedIds);
		// isEditing = false;
	}

	function handleCancelClick() {
		currentRelatedIds = relatedDreams.map((d) => d.id || ''); // Reset to original
		isEditing = false;
		searchQuery = '';
		searchResults = [];
	}

	function handleRemoveRelated(idToRemove: string) {
		currentRelatedIds = currentRelatedIds.filter((id) => id !== idToRemove);
	}

	function handleAddRelated(dreamToAdd: Partial<App.Dream>) {
		if (dreamToAdd.id && !currentRelatedIds.includes(dreamToAdd.id)) {
			currentRelatedIds = [...currentRelatedIds, dreamToAdd.id];
			// Also add to the displayed relatedDreams if it's not already there
			if (!relatedDreams.some(d => d.id === dreamToAdd.id)) {
				relatedDreams = [...relatedDreams, dreamToAdd];
			}
		}
		searchQuery = ''; // Clear search after adding
		searchResults = [];
	}

	async function handleRegenerateClick() {
		// This will now be handled by the form action
		// await onRegenerateRelatedDreams();
		// isEditing = false; // Exit edit mode after regeneration
	}

	async function searchDreams(query: string) {
		if (query.length < 3) {
			searchResults = [];
			return;
		}

		isSearching = true;
		try {
			const response = await fetch(`/dreams/${dreamId}?/searchDreams&query=${query}`);
			if (response.ok) {
				const data = await response.json();
				searchResults = data.dreams.filter((d: Partial<App.Dream>) => d.id !== dreamId && !currentRelatedIds.includes(d.id || ''));
			} else {
				console.error('Failed to search dreams:', response.statusText);
				searchResults = [];
			}
		} catch (error) {
			console.error('Error searching dreams:', error);
			searchResults = [];
		} finally {
			isSearching = false;
		}
	}

	$effect(() => {
		clearTimeout(searchTimeout);
		if (searchQuery) {
			searchTimeout = setTimeout(() => {
				searchDreams(searchQuery);
			}, 300); // Debounce search
		} else {
			searchResults = [];
		}
	});

	// Form action for updating related dreams
	const updateRelatedDreamsAction = enhance(
		({ form, data, action, cancel }) => {
			isUpdatingRelatedDreams = true;
			return async ({ result, update }) => {
				if (result.type === 'success') {
					dispatch('relatedDreamsUpdated', result.data?.dream);
					isEditing = false;
				} else if (result.type === 'error') {
					console.error('Failed to update related dreams:', result.error);
					// Optionally display error message to user
				}
				isUpdatingRelatedDreams = false;
				await update();
			};
		},
		({ form, data, action, cancel }) => {
			// This function runs before the request is sent
			// You can modify the form data here if needed
			data.set('relatedDreamIds', JSON.stringify(currentRelatedIds));
		}
	);

	// Form action for regenerating related dreams
	const regenerateRelatedDreamsAction = enhance(
		({ form, data, action, cancel }) => {
			isRegeneratingRelatedDreams = true;
			return async ({ result, update }) => {
				if (result.type === 'success') {
					dispatch('relatedDreamsUpdated', result.data?.dream);
					isEditing = false; // Exit edit mode after regeneration
				} else if (result.type === 'error') {
					console.error('Failed to regenerate related dreams:', result.error);
					// Optionally display error message to user
				}
				isRegeneratingRelatedDreams = false;
				await update();
			};
		}
	);
</script>

<div class="mb-6">
	<div class="mb-2 flex items-center justify-between">
		<h3 class="text-lg font-semibold">{m.related_dreams_title()}</h3>
		<div class="flex gap-2">
			{#if isEditing}
				<form method="POST" action="?/updateRelatedDreams" use:updateRelatedDreamsAction>
					<button
						type="submit"
						class="btn btn-sm btn-primary"
						disabled={isUpdatingRelatedDreams}
					>
						{#if isUpdatingRelatedDreams}
							<span class="loading loading-sm loading-spinner"></span>
						{:else}
							{m.save_button()}
						{/if}
					</button>
				</form>
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
				<form method="POST" action="?/regenerateRelatedDreams" use:regenerateRelatedDreamsAction>
					<button
						type="submit"
						class="btn btn-outline btn-sm"
						disabled={isRegeneratingRelatedDreams}
					>
						{#if isRegeneratingRelatedDreams}
							<span class="loading loading-sm loading-spinner"></span>
						{:else}
							{m.regenerate_relations_button()}
						{/if}
					</button>
				</form>
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
			<input
				type="text"
				placeholder={m.search_dreams_placeholder()}
				class="input-bordered input w-full"
				bind:value={searchQuery}
			/>
			<div class="mt-2">
				{#if isSearching}
					<p class="text-sm text-gray-500">Searching...</p>
				{:else if searchResults.length > 0}
					<ul class="menu bg-base-200 rounded-box w-full">
						{#each searchResults as dream}
							<li>
								<a href="#" on:click|preventDefault={() => handleAddRelated(dream)}>
									{dream.title || (dream.rawText ? dream.rawText.substring(0, 50) + '...' : 'Untitled')}
								</a>
							</li>
						{/each}
					</ul>
				{:else if searchQuery.length >= 3}
					<p class="text-sm text-gray-500">{m.no_dreams_found()}</p>
				{:else}
					<p class="text-sm text-gray-500">{m.search_dreams_hint()}</p>
				{/if}
			</div>
		</div>
	{/if}
</div>
