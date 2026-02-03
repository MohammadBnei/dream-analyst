<script lang="ts">
	interface Props {
		value: number;
		onChange: (value: number) => void;
		disabled?: boolean;
	}

	let { value = 3, onChange, disabled = false }: Props = $props();

	const labels = ['1', '2', '3', '4', '5'];

	const handleChange = (event: Event) => {
		const target = event.target as HTMLInputElement;
		onChange(parseInt(target.value));
	};
</script>

<div class="w-full">
	<div class="mb-2 flex justify-between">
		{#each labels as label, index}
			<span class="text-xs text-base-content/60">{label}</span>
		{/each}
	</div>
	<input
		type="range"
		min="1"
		max="5"
		{value}
		class="range range-primary"
		step="1"
		oninput={handleChange}
		{disabled}
	/>
	<div class="mt-1 flex justify-between text-xs text-base-content/50">
		<span>Poor</span>
		<span>Excellent</span>
	</div>
</div>
