<script lang="ts">
	type InsightType = 'META_ANALYSIS' | 'WEEKLY_SUMMARY' | 'MILESTONE' | 'PATTERN_ALERT';

	interface Props {
		title: string;
		description: string;
		type: InsightType;
		priority?: number;
		isRead?: boolean;
		createdAt: Date | string;
		onclick?: () => void;
	}

	let {
		title,
		description,
		type,
		priority = 3,
		isRead = false,
		createdAt,
		onclick
	}: Props = $props();

	const typeLabels: Record<InsightType, string> = {
		META_ANALYSIS: 'Meta-Analysis',
		WEEKLY_SUMMARY: 'Weekly Summary',
		MILESTONE: 'Milestone',
		PATTERN_ALERT: 'Pattern'
	};

	const typeBadgeColors: Record<InsightType, string> = {
		META_ANALYSIS: 'badge-primary',
		WEEKLY_SUMMARY: 'badge-info',
		MILESTONE: 'badge-success',
		PATTERN_ALERT: 'badge-warning'
	};

	const priorityColors = (p: number) => {
		if (p >= 4) return 'border-l-4 border-l-warning';
		if (p >= 3) return 'border-l-4 border-l-info';
		return 'border-l-4 border-l-base-300';
	};

	const formatDate = (date: Date | string) => {
		const d = typeof date === 'string' ? new Date(date) : date;
		const now = new Date();
		const diff = now.getTime() - d.getTime();
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));

		if (days === 0) return 'Today';
		if (days === 1) return 'Yesterday';
		if (days < 7) return `${days} days ago`;
		return d.toLocaleDateString();
	};
</script>

<button
	type="button"
	class="card w-full cursor-pointer bg-base-200 text-left transition-all duration-200 hover:bg-base-300 {priorityColors(
		priority
	)} {!isRead ? 'ring-2 ring-primary/30' : ''}"
	{onclick}
>
	<div class="card-body p-4">
		<div class="flex items-start justify-between gap-2">
			<div class="flex-1">
				<div class="mb-2 flex items-center gap-2">
					<span class="badge {typeBadgeColors[type]} badge-sm">
						{typeLabels[type]}
					</span>
					{#if !isRead}
						<span class="badge badge-xs badge-primary">New</span>
					{/if}
				</div>
				<h3 class="mb-1 text-base font-semibold">{title}</h3>
				<p class="line-clamp-2 text-sm text-base-content/70">{description}</p>
			</div>
		</div>
		<div class="mt-2 text-xs text-base-content/50">
			{formatDate(createdAt)}
		</div>
	</div>
</button>
