<script lang="ts">
	interface Props {
		title: string;
		content: string;
		icon?: string;
		blockId?: string;
		onDiscuss?: (blockId?: string) => void;
	}

	let { title, content, icon, blockId, onDiscuss }: Props = $props();
</script>

<div class="card bg-base-200 shadow-lg">
	<div class="card-body">
		<div class="mb-3 flex items-center gap-2">
			{#if icon}
				<span class="text-2xl">{icon}</span>
			{/if}
			<h3 class="card-title text-lg">{title}</h3>
		</div>

		<div class="prose prose-sm max-w-none">
			<p class="text-base-content/80">{content}</p>
		</div>

		{#if onDiscuss}
			<div class="mt-4 card-actions justify-end">
				<button
					type="button"
					class="btn border-none bg-[#c4a777] text-white btn-sm hover:bg-[#b89760]"
					onclick={() => onDiscuss?.(blockId)}
				>
					💬 Discuss this Aspect
				</button>
			</div>
		{/if}
	</div>
</div>
