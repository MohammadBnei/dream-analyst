<script lang="ts">
	import { onMount } from 'svelte';
	import SymbolCloud from '../shared/SymbolCloud.svelte';
	import { goto } from '$app/navigation';

	type Sentiment = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'AMBIVALENT';

	interface Symbol {
		id: string;
		name: string;
		category?: string | null;
		sentiment?: Sentiment | null;
		occurrenceCount: number;
		firstSeenAt: Date | string;
		lastSeenAt: Date | string;
	}

	interface Props {
		symbols: Symbol[];
	}

	let { symbols = [] }: Props = $props();

	const handleSymbolClick = (symbol: Symbol) => {
		goto(`/trends?symbol=${encodeURIComponent(symbol.name)}`);
	};
</script>

<div class="card bg-base-200 shadow-lg">
	<div class="card-body">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="card-title text-lg">Recurring Symbols</h2>
			<div class="tooltip" data-tip="Symbols sized by frequency">
				<button type="button" class="btn btn-circle btn-ghost btn-xs">
					<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
							clip-rule="evenodd"
						/>
					</svg>
				</button>
			</div>
		</div>

		<SymbolCloud {symbols} onSymbolClick={handleSymbolClick} maxDisplay={20} />

		{#if symbols.length === 0}
			<div class="py-8 text-center">
				<p class="text-sm text-base-content/50">
					No symbols detected yet. Record your first dream to see patterns!
				</p>
			</div>
		{/if}
	</div>
</div>
