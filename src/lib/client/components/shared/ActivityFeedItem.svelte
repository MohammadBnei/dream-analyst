<script lang="ts">
	type ActivityType = 'dream' | 'analysis' | 'insight' | 'chat';

	interface Props {
		type: ActivityType;
		title: string;
		description?: string;
		timestamp: Date | string;
		onclick?: () => void;
	}

	let { type, title, description, timestamp, onclick }: Props = $props();

	const icons: Record<ActivityType, string> = {
		dream: '🌙',
		analysis: '✨',
		insight: '💡',
		chat: '💬'
	};

	const formatTime = (date: Date | string) => {
		const d = typeof date === 'string' ? new Date(date) : date;
		const now = new Date();
		const diff = now.getTime() - d.getTime();
		const minutes = Math.floor(diff / (1000 * 60));
		const hours = Math.floor(diff / (1000 * 60 * 60));
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));

		if (minutes < 1) return 'Just now';
		if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
		if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
		if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
		return d.toLocaleDateString();
	};
</script>

<button
	type="button"
	class="flex w-full items-start gap-3 rounded-lg p-3 text-left transition-all duration-200 hover:bg-base-200"
	{onclick}
	disabled={!onclick}
>
	<span class="flex-shrink-0 text-2xl">{icons[type]}</span>
	<div class="min-w-0 flex-1">
		<p class="truncate text-sm font-medium">{title}</p>
		{#if description}
			<p class="truncate text-xs text-base-content/60">{description}</p>
		{/if}
		<p class="mt-1 text-xs text-base-content/50">{formatTime(timestamp)}</p>
	</div>
</button>
