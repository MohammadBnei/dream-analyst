<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title?: string;
		description?: string;
		loading?: boolean;
		error?: string;
		children: Snippet;
	}

	let { title, description, loading = false, error, children }: Props = $props();
</script>

<div class="card bg-base-200">
	<div class="card-body">
		{#if title}
			<h3 class="mb-2 card-title text-lg">{title}</h3>
		{/if}
		{#if description}
			<p class="mb-4 text-sm text-base-content/70">{description}</p>
		{/if}

		{#if loading}
			<div class="flex h-64 items-center justify-center">
				<span class="loading loading-lg loading-spinner"></span>
			</div>
		{:else if error}
			<div class="alert alert-error">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6 shrink-0 stroke-current"
					fill="none"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<span>{error}</span>
			</div>
		{:else}
			<div class="w-full">
				{@render children()}
			</div>
		{/if}
	</div>
</div>
