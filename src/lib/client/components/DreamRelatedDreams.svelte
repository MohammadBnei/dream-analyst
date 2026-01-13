<script lang="ts">
	import { goto } from '$app/navigation';
	import * as m from '$lib/paraglide/messages';
	import { enhance } from '$app/forms';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	let { dreamId, relatedDreams } = $props<{
		dreamId: string;
		relatedDreams: Partial<App.Dream[]>;
	}>();

	let isEditing = $state(false);
	let currentRelatedIds = $state<string[]>(relatedDreams.map((d) => d.id || ''));
	let searchQuery = $state('');
	let searchResults = $state<Partial<App.Dream>[]>([]);
	let isSearching = $state(false);
	let searchTimeout: ReturnType<typeof setTimeout>;

	// Local loading states for form actions
	let isUpdatingRelatedDreams = $state(false);
	let isRegeneratingRelatedDreams = $state(false);
	let isDeletingRelated = $state<{ [key: string]: boolean }>({}); // Track deletion state for each related dream

	// Effect to update currentRelatedIds when relatedDreams prop changes
	$effect(() => {
		currentRelatedIds = relatedDreams.map((d) => d.id || '');
	});

	function navigateToDream(id: string) {
		goto(`/dreams/${id}`);
	}

	function handleEditClick() {
		isEditing = true;
	}

	function handleCancelClick() {
		currentRelatedIds = relatedDreams.map((d) => d.id || ''); // Reset to original
		isEditing = false;
		searchQuery = '';
		searchResults = [];
	}

	function handleAddRelated(dreamToAdd: Partial<App.Dream>) {
		if (dreamToAdd.id && !currentRelatedIds.includes(dreamToAdd.id)) {
			currentRelatedIds = [...currentRelatedIds, dreamToAdd.id];
			// Optimistically add to the displayed relatedDreams for immediate feedback
			if (!relatedDreams.some((d) => d.id === dreamToAdd.id)) {
				relatedDreams = [...relatedDreams, dreamToAdd];
			}
		}
	}
</script>

<div class="mb-6">
	<div class="mb-2 flex items-center justify-between">
		<h3 class="text-lg font-semibold">{m.related_dreams_title()}</h3>
		<div class="flex gap-2">
			{#if isEditing}
				<form
					method="POST"
					action="?/updateRelatedDreams"
					use:enhance={() => {
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
					}}
				>
					<input type="hidden" name="relatedDreamIds" value={JSON.stringify(currentRelatedIds)} />
					<button type="submit" class="btn btn-sm btn-primary" disabled={isUpdatingRelatedDreams}>
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
				<button
					class="btn btn-outline btn-sm"
					onclick={handleEditClick}
					aria-label="edit related dreams"
				>
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
				<form
					method="POST"
					action="?/regenerateRelatedDreams"
					use:enhance={() => {
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
					}}
				>
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
						<form
							method="POST"
							action="?/removeRelatedDream"
							use:enhance={() => {
								isDeletingRelated = { ...isDeletingRelated, [relatedDream.id || '']: true };
								return async ({ result, update }) => {
									if (result.type === 'success') {
										dispatch('relatedDreamsUpdated', result.data?.dream);
										// Optimistically remove from currentRelatedIds if not already done by dispatch
										currentRelatedIds = currentRelatedIds.filter((id) => id !== relatedDream.id);
									} else if (result.type === 'error') {
										console.error('Failed to remove related dream:', result.error);
										// Optionally display error message to user
									}
									isDeletingRelated = { ...isDeletingRelated, [relatedDream.id || '']: false };
									await update();
								};
							}}
						>
							<input type="hidden" name="relatedDreamId" value={relatedDream.id} />
							<button
								type="submit"
								class="btn btn-circle btn-ghost btn-xs"
								disabled={isDeletingRelated[relatedDream.id || '']}
							>
								{#if isDeletingRelated[relatedDream.id || '']}
									<span class="loading loading-sm loading-spinner"></span>
								{:else}
									✕
								{/if}
							</button>
						</form>
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
			<form
				id="search-dreams-form"
				method="POST"
				action="?/searchDreams"
				use:enhance={({ formData, cancel }) => {
					isSearching = true;
					formData.set('query', searchQuery); // Always set the query from bind:value

					// Only send if query is long enough
					if (searchQuery.length < 3) {
						cancel(); // Prevent form submission
						searchResults = [];
						isSearching = false; // Reset loading state
						return;
					}

					return async ({ result }) => {
						// Removed 'update' as it's not needed here
						if (result.type === 'success') {
							searchResults = result.data?.dreams || [];
						} else if (result.type === 'error') {
							console.error('Failed to search dreams:', result.error);
							searchResults = [];
						}
						isSearching = false;
						// No update() call here, as we're only updating local state (searchResults)
					};
				}}
			>
				<input
					type="text"
					name="query"
					placeholder={m.search_dreams_placeholder()}
					class="input-bordered input w-full"
					bind:value={searchQuery}
					disabled={isSearching}
				/>
			</form>
			<div class="mt-2">
				{#if isSearching}
					<p class="text-sm text-gray-500">Searching...</p>
				{:else if searchResults.length > 0}
					<ul class="menu w-full rounded-box bg-base-200">
						{#each searchResults as dream}
							<li>
								<span class="btn" onclick={() => handleAddRelated(dream)}>
									{dream.title ||
										(dream.rawText ? dream.rawText.substring(0, 50) + '...' : 'Untitled')}
								</span>
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
