<script lang="ts">
	type Mood = 'happy' | 'calm' | 'neutral' | 'anxious';

	interface Props {
		selected?: Mood | null;
		onSelect: (mood: Mood) => void;
		disabled?: boolean;
	}

	let { selected = null, onSelect, disabled = false }: Props = $props();

	const moods: { value: Mood; emoji: string; label: string }[] = [
		{ value: 'happy', emoji: '😊', label: 'Happy' },
		{ value: 'calm', emoji: '😌', label: 'Calm' },
		{ value: 'neutral', emoji: '😐', label: 'Neutral' },
		{ value: 'anxious', emoji: '😰', label: 'Anxious' }
	];

	const handleSelect = (mood: Mood) => {
		if (!disabled) {
			onSelect(mood);
		}
	};
</script>

<div class="flex gap-3">
	{#each moods as mood}
		<button
			type="button"
			class="btn btn-circle transition-all duration-200 btn-lg {selected === mood.value
				? 'scale-110 btn-primary'
				: 'btn-ghost hover:scale-105'}"
			onclick={() => handleSelect(mood.value)}
			{disabled}
			title={mood.label}
		>
			<span class="text-3xl">{mood.emoji}</span>
		</button>
	{/each}
</div>
