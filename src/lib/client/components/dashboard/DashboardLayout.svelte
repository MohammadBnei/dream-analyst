<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		leftSidebar: Snippet;
		mainContent: Snippet;
		rightSidebar?: Snippet;
	}

	let { leftSidebar, mainContent, rightSidebar }: Props = $props();
</script>

<div class="container mx-auto px-4 py-6">
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
		<!-- Left Sidebar: Quick Capture + Recent Activity -->
		<div class="space-y-6 lg:col-span-3">
			{@render leftSidebar()}
		</div>

		<!-- Main Content Area -->
		<div
			class={{
				'lg:col-span-6': rightSidebar,
				'lg:col-span-9': !rightSidebar
			}}
		>
			{@render mainContent()}
		</div>

		<!-- Right Sidebar: Recurring Symbols (if provided) -->
		{#if rightSidebar}
			<div class="lg:col-span-3">
				{@render rightSidebar()}
			</div>
		{/if}
	</div>
</div>
