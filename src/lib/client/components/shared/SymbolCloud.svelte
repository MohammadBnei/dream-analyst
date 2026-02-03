<script lang="ts">
	import SymbolTag from './SymbolTag.svelte';
	import type { ComponentProps } from 'svelte';

	type Sentiment = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'AMBIVALENT';

	interface Symbol {
		id: string;
		name: string;
		category?: string | null;
		sentiment?: Sentiment | null;
		occurrenceCount: number;
		firstSeenAt?: Date | string;
		lastSeenAt?: Date | string;
	}

	interface Props {
		symbols: Symbol[];
		onSymbolClick?: (symbol: Symbol) => void;
		maxDisplay?: number;
		className?: string;
	}

	let { symbols = [], onSymbolClick, maxDisplay = 20, className = '' }: Props = $props();

	const displaySymbols = symbols.slice(0, maxDisplay);
	const hasMore = symbols.length > maxDisplay;
</script>

<div class="flex flex-wrap items-center gap-2 {className}">
	{#each displaySymbols as symbol (symbol.id)}
		<SymbolTag
			name={symbol.name}
			sentiment={symbol.sentiment}
			frequency={symbol.occurrenceCount}
			clickable={!!onSymbolClick}
			onclick={() => onSymbolClick?.(symbol)}
		/>
	{/each}

	{#if hasMore}
		<button class="badge badge-ghost text-xs opacity-70 hover:opacity-100" type="button">
			+{symbols.length - maxDisplay} more
		</button>
	{/if}

	{#if symbols.length === 0}
		<p class="text-sm text-base-content/50 italic">No symbols detected yet</p>
	{/if}
</div>
