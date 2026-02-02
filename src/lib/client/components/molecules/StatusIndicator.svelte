<script lang="ts">
	import Badge from '../atoms/Badge.svelte';

	type DreamStatus = 'COMPLETED' | 'PENDING_ANALYSIS' | 'ANALYSIS_FAILED';

	let {
		status,
		class: className = ''
	}: {
		status: DreamStatus | string;
		class?: string;
	} = $props();

	type BadgeVariant = 'success' | 'warning' | 'error' | 'neutral';

	const statusConfig: Record<
		DreamStatus,
		{ variant: BadgeVariant; label: string }
	> = {
		COMPLETED: { variant: 'success', label: 'Completed' },
		PENDING_ANALYSIS: { variant: 'warning', label: 'Pending Analysis' },
		ANALYSIS_FAILED: { variant: 'error', label: 'Analysis Failed' }
	};

	const config = $derived(
		statusConfig[status as DreamStatus] || {
			variant: 'neutral' as const,
			label: status.replace(/_/g, ' ')
		}
	);
</script>

<Badge variant={config.variant} class={className}>
	{config.label}
</Badge>
