<script lang="ts">
	import StatCard from '../shared/StatCard.svelte';

	interface Stats {
		totalDreams: number;
		dreamsThisWeek: number;
		totalSymbols: number;
		averageMood?: number;
	}

	interface Props {
		stats: Stats;
	}

	let { stats }: Props = $props();
</script>

<div class="stats w-full stats-vertical bg-base-200 shadow lg:stats-horizontal">
	<StatCard label="Total Dreams" value={stats.totalDreams} icon="🌙" />

	<StatCard
		label="This Week"
		value={stats.dreamsThisWeek}
		icon="📅"
		trend={stats.dreamsThisWeek > 0 ? 'up' : 'neutral'}
		trendValue={stats.dreamsThisWeek > 0 ? `+${stats.dreamsThisWeek} this week` : 'No dreams yet'}
	/>

	<StatCard label="Symbols" value={stats.totalSymbols} icon="✨" />

	{#if stats.averageMood !== undefined}
		<StatCard label="Avg. Mood" value={`${Math.round(stats.averageMood)}%`} icon="😊" />
	{/if}
</div>
