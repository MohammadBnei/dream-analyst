<script lang="ts">
	interface Props {
		label: string;
		value: number | string;
		icon?: string;
		trend?: 'up' | 'down' | 'neutral';
		trendValue?: string;
	}

	let { label, value, icon, trend, trendValue }: Props = $props();

	const trendIcons = {
		up: '↗',
		down: '↘',
		neutral: '→'
	};

	const trendColors = {
		up: 'text-success',
		down: 'text-error',
		neutral: 'text-base-content/50'
	};
</script>

<div class="stat rounded-lg bg-base-200">
	<div class="stat-figure text-3xl">
		{icon || '📊'}
	</div>
	<div class="stat-title text-base-content/70">{label}</div>
	<div class="stat-value text-3xl">{value}</div>
	{#if trend && trendValue}
		<div class="stat-desc {trendColors[trend]}">
			{trendIcons[trend]}
			{trendValue}
		</div>
	{/if}
</div>
