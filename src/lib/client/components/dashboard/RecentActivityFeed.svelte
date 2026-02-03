<script lang="ts">
	import ActivityFeedItem from '../shared/ActivityFeedItem.svelte';
	import { goto } from '$app/navigation';

	interface Activity {
		id: string;
		type: 'dream' | 'analysis' | 'insight' | 'chat';
		title: string;
		description?: string;
		timestamp: Date | string;
		dreamId?: string;
	}

	interface Props {
		activities: Activity[];
	}

	let { activities = [] }: Props = $props();

	const handleActivityClick = (activity: Activity) => {
		if (activity.dreamId) {
			goto(`/dreams/${activity.dreamId}`);
		}
	};
</script>

<div class="card bg-base-200 shadow-lg">
	<div class="card-body">
		<h2 class="mb-4 card-title text-lg">Recent Activity</h2>

		{#if activities.length > 0}
			<div class="space-y-2">
				{#each activities.slice(0, 5) as activity (activity.id)}
					<ActivityFeedItem
						type={activity.type}
						title={activity.title}
						description={activity.description}
						timestamp={activity.timestamp}
						onclick={() => handleActivityClick(activity)}
					/>
				{/each}
			</div>
		{:else}
			<div class="py-8 text-center">
				<p class="text-sm text-base-content/50">No recent activity</p>
			</div>
		{/if}

		{#if activities.length > 5}
			<div class="mt-4 card-actions justify-center">
				<button type="button" class="btn btn-ghost btn-sm" onclick={() => goto('/dreams')}>
					View All Activity
				</button>
			</div>
		{/if}
	</div>
</div>
