<script lang="ts">
	import type { PageData } from './$types';
	import { fade } from 'svelte/transition';
	import * as m from '$lib/paraglide/messages';

	export let data: PageData;

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
</script>

<div class="container mx-auto max-w-4xl p-4">
	<h1 class="mb-6 text-center text-3xl font-bold">{m.your_dreams_title()}</h1>

	{#if data.dreams.length === 0}
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
			{#each data.dreams as dream (dream.id)}
				<div class="card bg-base-100 shadow-xl" transition:fade>
					<div class="card-body">
						<div class="mb-2 flex items-start justify-between">
							<h2 class="card-title text-lg">
								{m.dream_on_date({ date: dream.createdAt.toLocaleDateString() })}
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
							<a href={`/dreams/${dream.id}`} class="btn btn-sm btn-primary">{m.view_details_button()}</a>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
