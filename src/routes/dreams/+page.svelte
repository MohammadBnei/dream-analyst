<script lang="ts">
	import { fade } from 'svelte/transition';
	import * as m from '$lib/paraglide/messages';
	import { invalidateAll, goto } from '$app/navigation';
	import { enhance } from '$app/forms';

	// Data loaded from +page.server.ts
	let { data, form } = $props(); // Use $props() for both data and form

	let dreams = $derived(data.dreams);

	// Define DreamStatus locally based on the dream object's status type
	// Assuming all dreams in the array will have a consistent status type
	type DreamStatus = (typeof dreams)[number]['status'];

	let clientError: string | null = $state(null); // For errors during client-side actions like cancelAnalysis confirmation
	let searchQuery: string = $state(data.query || ''); // Initialize searchQuery with data.query

	// Handle form action responses
	$effect(() => {
		if (form?.success) {
			// Invalidate all data to refetch dreams and update UI after a successful action
			invalidateAll();
		}
		if (form?.error) {
			console.error('Form action error:', form.error);
			clientError = form.error;
		}
	});

	// Function to determine badge color based on dream status
	function getStatusBadgeClass(status: DreamStatus) {
		switch (status) {
			case 'COMPLETED': // Use string literal
				return 'badge-success';
			case 'PENDING_ANALYSIS': // Use string literal
				return 'badge-info';
			case 'ANALYSIS_FAILED': // Use string literal
				return 'badge-error';
			default:
				return 'badge-neutral';
		}
	}

	async function handleSearch(e?: SubmitEvent) {
		e?.preventDefault();
		await goto(`?query=${searchQuery}`);
	}

	function resetSearch() {
		searchQuery = '';
		handleSearch(); // Trigger search with empty query
	}
</script>

<svelte:head>
	<title>{m.your_dreams_title()} - {m.app_name()}</title>
	<meta name="description" content={m.dreams_page_description()} />
	<!-- Open Graph / Facebook -->
	<meta property="og:title" content={m.your_dreams_title()} />
	<meta property="og:description" content={m.dreams_page_description()} />
	<!-- Twitter -->
	<meta property="twitter:title" content={m.your_dreams_title()} />
	<meta property="twitter:description" content={m.dreams_page_description()} />
</svelte:head>

<div class="container mx-auto max-w-4xl p-4">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-3xl font-bold">{m.your_dreams_title()}</h1>
		<a href="/dreams/new" class="btn btn-primary">{m.add_new_dream_button()}</a>
	</div>

	<div class="mb-6">
		<form onsubmit={handleSearch}>
			<label class="input-bordered input flex items-center gap-2">
				<input
					type="text"
					class="grow"
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
				<button type="button" class="btn mt-2 btn-ghost btn-sm" onclick={resetSearch}>
					{m.reset_search_button()}
				</button>
			{/if}
		</form>
	</div>

	{#if clientError}
		<div role="alert" class="alert alert-error">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-6 w-6 shrink-0 stroke-current"
				fill="none"
				viewBox="0 0 24 24"
				><path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
				></path></svg
			>
			<span>Error: {clientError}</span>
			<button class="btn btn-ghost btn-sm" onclick={() => (clientError = null)}>Clear</button>
		</div>
	{:else if dreams.length === 0}
		<div class="hero rounded-box bg-base-200 p-8">
			<div class="hero-content text-center">
				<div class="max-w-md">
					<h2 class="mb-4 text-2xl font-bold">{m.no_dreams_recorded_title()}</h2>
					<p class="mb-5">{m.no_dreams_recorded_message()}</p>
					<a href="/dreams/new" class="btn btn-lg btn-primary">{m.add_new_dream_button()}</a>
				</div>
			</div>
		</div>
	{:else}
		<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
			{#each dreams as dream (dream.id)}
				<div class="card bg-base-100 shadow-xl" transition:fade>
					<div class="card-body">
						<div class="mb-2 flex items-start justify-between">
							<h2 class="card-title text-lg">
								{m.dream_on_date({ date: new Date(dream.createdAt).toLocaleDateString() })}
							</h2>
							<span class="badge {getStatusBadgeClass(dream.status)}"
								>{dream.status.replace('_', ' ')}</span
							>
						</div>

						<p class="mb-4 line-clamp-3 text-sm text-base-content/80">
							{dream.rawText}
						</p>

						{#if dream.tags && dream.tags.length > 0}
							<div class="mb-4 flex flex-wrap gap-2">
								{#each dream.tags as tag}
									<span class="badge badge-outline badge-sm">{tag}</span>
								{/each}
							</div>
						{/if}

						{#if dream.interpretation}
							<p class="line-clamp-3 text-sm text-base-content/70 italic">
								{dream.interpretation}
							</p>
						{:else if dream.status === 'PENDING_ANALYSIS'}
							<p class="text-sm text-info italic">{m.analysis_pending_message()}</p>
						{:else if dream.status === 'ANALYSIS_FAILED'}
							<p class="text-sm text-error italic">{m.ANALYSIS_FAILED_try_again_message()}</p>
						{/if}

						<div class="mt-4 card-actions justify-end">
							<!-- {#if dream.status === 'PENDING_ANALYSIS'}
								<form
									method="POST"
									action="?/cancelAnalysis"
									use:enhance={({ cancel }) => {
										return () => {
											if (!confirmCancelAnalysis(dream.id)) {
												cancel(); // Prevent form submission if confirmation fails
											}
										};
									}}
								>
									<input type="hidden" name="dreamId" value={dream.id} />
									<button type="submit" class="btn btn-sm btn-warning">
										{m.cancel_analysis_button()}
									</button>
								</form>
							{/if} -->
							<a href={`/dreams/${dream.id}`} class="btn btn-sm btn-primary"
								>{m.view_details_button()}</a
							>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
