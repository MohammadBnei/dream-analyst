<script lang="ts">
	import MoodSelector from '../shared/MoodSelector.svelte';
	import SleepQualitySlider from '../shared/SleepQualitySlider.svelte';
	import { creditStore } from '$lib/client/stores/creditStore';
	import { goto } from '$app/navigation';

	type Mood = 'happy' | 'calm' | 'neutral' | 'anxious';

	let dreamText = $state('');
	let selectedMood = $state<Mood | null>(null);
	let sleepQuality = $state(3);
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);

	const credits = $derived($creditStore);
	const ANALYSIS_COST = 3;
	const canAfford = $derived(credits.balance >= ANALYSIS_COST);

	const handleSubmit = async () => {
		if (!dreamText.trim()) {
			error = 'Please enter your dream';
			return;
		}

		if (!canAfford) {
			error = 'Insufficient credits';
			return;
		}

		isSubmitting = true;
		error = null;

		try {
			// Optimistically deduct credits
			creditStore.optimisticDeduct(ANALYSIS_COST);

			const metadata: Record<string, unknown> = {
				preSleepMood: selectedMood,
				sleepQualityScore: sleepQuality
			};

			const response = await fetch('/api/dreams', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					rawText: dreamText,
					metadata,
					promptType: 'jungian'
				})
			});

			if (!response.ok) {
				// Rollback on failure
				creditStore.rollback(ANALYSIS_COST);
				throw new Error('Failed to create dream');
			}

			const data = await response.json();

			// Navigate to the new dream
			await goto(`/dreams/${data.dreamId}`);
		} catch (err) {
			console.error('Error creating dream:', err);
			error = err instanceof Error ? err.message : 'Failed to record dream';
			isSubmitting = false;
		}
	};
</script>

<div class="card bg-base-200 shadow-lg">
	<div class="card-body">
		<h2 class="mb-4 card-title text-xl">Quick Capture</h2>

		<form onsubmit={handleSubmit} class="space-y-4">
			<!-- Dream Text Input -->
			<div>
				<textarea
					bind:value={dreamText}
					placeholder="Enter your dream text here..."
					class="textarea-bordered textarea h-32 w-full resize-none"
					disabled={isSubmitting}
				></textarea>
			</div>

			<!-- Mood Selector -->
			<div>
				<label class="label">
					<span class="label-text font-medium">Mood</span>
				</label>
				<MoodSelector
					selected={selectedMood}
					onSelect={(mood) => (selectedMood = mood)}
					disabled={isSubmitting}
				/>
			</div>

			<!-- Sleep Quality Slider -->
			<div>
				<label class="label">
					<span class="label-text font-medium">Sleep Quality</span>
				</label>
				<SleepQualitySlider
					value={sleepQuality}
					onChange={(val) => (sleepQuality = val)}
					disabled={isSubmitting}
				/>
			</div>

			<!-- Error Message -->
			{#if error}
				<div class="alert alert-error">
					<span class="text-sm">{error}</span>
				</div>
			{/if}

			<!-- Submit Button -->
			<button
				type="submit"
				class="btn w-full bg-[#c4a777] text-white hover:bg-[#b89760]"
				disabled={isSubmitting || !canAfford}
			>
				{#if isSubmitting}
					<span class="loading loading-spinner"></span>
					Recording...
				{:else if !canAfford}
					Insufficient Credits
				{:else}
					Record Dream ({ANALYSIS_COST} credits)
				{/if}
			</button>
		</form>
	</div>
</div>
