<script lang="ts">
	import type { PageData } from './$types';
	import { fade } from 'svelte/transition';
	import { format } from 'date-fns';

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

<div class="container mx-auto p-4 max-w-4xl">
	<h1 class="text-3xl font-bold mb-6 text-center">Your Dreams</h1>

	{#if data.dreams.length === 0}
		<div class="hero bg-base-200 rounded-box p-8">
			<div class="hero-content text-center">
				<div class="max-w-md">
					<h2 class="text-2xl font-bold mb-4">No dreams recorded yet!</h2>
					<p class="mb-5">Start your dream journaling journey by adding your first dream.</p>
					<a href="/dreams/new" class="btn btn-primary btn-lg">Add New Dream</a>
				</div>
			</div>
		</div>
	{:else}
		<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
			{#each data.dreams as dream (dream.id)}
				<div class="card bg-base-100 shadow-xl" transition:fade>
					<div class="card-body">
						<div class="flex justify-between items-start mb-2">
							<h2 class="card-title text-lg">
								Dream on {format(new Date(dream.createdAt), 'PPP')}
							</h2>
							<span class="badge {getStatusBadgeClass(dream.status)}">{dream.status.replace('_', ' ')}</span>
						</div>

						<p class="text-sm text-base-content/80 mb-4 line-clamp-3">
							{dream.rawText}
						</p>

						{#if dream.tags && dream.tags.length > 0}
							<div class="flex flex-wrap gap-2 mb-4">
								{#each dream.tags as tag}
									<span class="badge badge-outline badge-sm">{tag}</span>
								{/each}
							</div>
						{/if}

						{#if dream.interpretation}
							<p class="text-sm italic text-base-content/70 line-clamp-3">
								{dream.interpretation}
							</p>
						{:else if dream.status === 'pending_analysis'}
							<p class="text-sm italic text-info">Analysis pending...</p>
						{:else if dream.status === 'analysis_failed'}
							<p class="text-sm italic text-error">Analysis failed. Please try again later.</p>
						{/if}

						<div class="card-actions justify-end mt-4">
							<a href={`/dreams/${dream.id}`} class="btn btn-sm btn-primary">View Details</a>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
