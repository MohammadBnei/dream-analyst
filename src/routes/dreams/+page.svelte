<script lang="ts">
	import { fade } from 'svelte/transition';
	import * as m from '$lib/paraglide/messages';
	import { getDreams } from '$lib/remote/dream.remote';
	import { invalidateAll } from '$app/navigation';

	// Fetch dreams using the remote query
	let dreamsPromise = getDreams(); // getDreams() returns a promise-like object

	// Function to determine badge color based on dream status
	function getStatusBadgeClass(status: App.Dream['status']) {
		switch (status) {
			case 'completed':
				return 'badge-success';
			case 'pending_analysis':
				return 'badge-info';
			case 'analysis_failed':
				return 'badge-error';
			default:
				return 'badge-neutral';
		}
	}

	async function cancelAnalysis(dreamId: string) {
		if (!confirm('Are you sure you want to cancel the analysis for this dream?')) {
			return;
		}

		try {
			const response = await fetch(`/api/dreams/${dreamId}/cancel-analysis`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to cancel analysis');
			}

			alert('Analysis cancelled successfully!');
			// Invalidate all data to refetch dreams and update UI
			await invalidateAll();
		} catch (error) {
			console.error('Error cancelling analysis:', error);
			alert(`Error cancelling analysis: ${error.message}`);
		}
	}
</script>

<div class="container mx-auto max-w-4xl p-4">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-3xl font-bold">{m.your_dreams_title()}</h1>
		<a href="/dreams/new" class="btn btn-primary">{m.add_new_dream_button()}</a>
	</div>

	{#await dreamsPromise}
		<div class="flex justify-center items-center h-64">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:then resolvedDreams}
		{#if resolvedDreams.length === 0}
			<div class="hero rounded-box bg-base-200 p-8">
				<div class="hero-content text-center">
					<div class="max-w-md">
						<h2 class="mb-4 text-2xl font-bold">{m.no_dreams_recorded_title()}</h2>
						<p class="mb-5">{m.no_dreams_recorded_message()}</p>
						<a href="/dreams/new" class="btn btn-lg btn-primary">{m.add_new_dream_button()}</a>
					</div>
				</div>
			</div>
		{#else}
			<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				{#each resolvedDreams as dream (dream.id)}
					<div class="card bg-base-100 shadow-xl" transition:fade>
						<div class="card-body">
							<div class="mb-2 flex items-start justify-between">
								<h2 class="card-title text-lg">
									{m.dream_on_date({ date: new Date(dream.createdAt).toLocaleDateString() })}
								</h2>
								<span class="badge {getStatusBadgeClass(dream.status as App.Dream['status'])}"
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
							{:else if dream.status === 'pending_analysis'}
								<p class="text-sm text-info italic">{m.analysis_pending_message()}</p>
							{:else if dream.status === 'analysis_failed'}
								<p class="text-sm text-error italic">{m.analysis_failed_try_again_message()}</p>
							{/if}

							<div class="mt-4 card-actions justify-end">
								{#if dream.status === 'pending_analysis'}
									<button
										on:click={() => cancelAnalysis(dream.id)}
										class="btn btn-sm btn-warning"
									>
										{m.cancel_analysis_button()}
									</button>
								{/if}
								<a href={`/dreams/${dream.id}`} class="btn btn-sm btn-primary">{m.view_details_button()}</a>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{:catch error}
		<div role="alert" class="alert alert-error">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="stroke-current shrink-0 h-6 w-6"
				fill="none"
				viewBox="0 0 24 24"
				><path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
				></path></svg
			>
			<span>Error loading dreams: {error.message}</span>
			<!-- No direct retry for await block, user can navigate or refresh page -->
		</div>
	{/await}
</div>
