<script lang="ts">
	import { fade } from 'svelte/transition';
	import * as m from '$lib/paraglide/messages';
	import RichTextInput from '$lib/client/components/RichTextInput.svelte';
	import { enhance } from '$app/forms';

	export let form; // Data from form action

	let dreamText: string = form?.rawText || '';
	let contextText: string = form?.context || '';
	let emotionsText: string = form?.emotions || '';
	let isSaving: boolean = false;
	let currentStep: number = 1;

	$: isNextDisabled = currentStep === 1 && dreamText.length < 10;

	function handleRichTextInput(value: string) {
		dreamText = value;
	}

	function nextStep() {
		if (currentStep < 3) currentStep++;
	}

	function prevStep() {
		if (currentStep > 1) currentStep--;
	}

	// Reset form after successful submission (handled by redirect) or on error
	$: if (form?.error) {
		isSaving = false;
	} else if (form?.success) {
		dreamText = '';
		contextText = '';
		emotionsText = '';
		isSaving = false;
		currentStep = 1;
	}
</script>

<div class="container mx-auto max-w-2xl p-4">
	<h1 class="mb-6 text-center text-3xl font-bold">{m.new_dream_title()}</h1>

	<!-- Steps Component -->
	<ul class="steps w-full mb-8">
		<li class="step {currentStep >= 1 ? 'step-primary' : ''}">Dream</li>
		<li class="step {currentStep >= 2 ? 'step-primary' : ''}">Context</li>
		<li class="step {currentStep >= 3 ? 'step-primary' : ''}">Emotions</li>
	</ul>

	<form
		method="POST"
		action="?/createDream"
		use:enhance={() => {
			isSaving = true;
			return async ({ update }) => {
				await update();
				isSaving = false;
			};
		}}
		class="space-y-6"
	>
		<!-- Step 1: The Dream -->
		<div class={currentStep === 1 ? 'block' : 'hidden'}>
			<div class="form-control">
				<label for="dreamText" class="label">
					<span class="label-text text-lg font-semibold">{m.what_did_you_dream_label()}</span>
				</label>
				<RichTextInput
					id="dreamText"
					name="rawText"
					placeholder={m.describe_dream_placeholder()}
					rows={8}
					bind:value={dreamText}
					onInput={handleRichTextInput}
				/>
				<label class="label">
					<span class="label-text-alt">{m.minimum_characters_label({ count: 10 })}</span>
				</label>
			</div>
		</div>

		<!-- Step 2: Context -->
		<div class={currentStep === 2 ? 'block' : 'hidden'}>
			<div class="form-control">
				<label for="context" class="label">
					<span class="label-text text-lg font-semibold">Life Context</span>
				</label>
				<p class="text-sm text-base-content/70 mb-2">
					What's happening in your life right now? Mention any specific events, movies, conversations, or stressors that might have influenced this dream.
				</p>
				<textarea
					id="context"
					name="context"
					class="textarea textarea-bordered h-48 text-base"
					placeholder="e.g., I watched a scary movie before bed, I'm stressed about a project at work..."
					bind:value={contextText}
				></textarea>
			</div>
		</div>

		<!-- Step 3: Emotions -->
		<div class={currentStep === 3 ? 'block' : 'hidden'}>
			<div class="form-control">
				<label for="emotions" class="label">
					<span class="label-text text-lg font-semibold">Emotional Landscape</span>
				</label>
				<p class="text-sm text-base-content/70 mb-2">
					How did you feel during the dream? How did you feel when you woke up?
				</p>
				<textarea
					id="emotions"
					name="emotions"
					class="textarea textarea-bordered h-48 text-base"
					placeholder="e.g., I felt anxious during the dream but relieved when I woke up. The atmosphere was heavy..."
					bind:value={emotionsText}
				></textarea>
			</div>
		</div>

		<!-- Navigation Buttons -->
		<div class="flex justify-between mt-8">
			{#if currentStep > 1}
				<button type="button" class="btn btn-neutral" on:click={prevStep} disabled={isSaving}>
					Back
				</button>
			{:else}
				<div></div> <!-- Spacer -->
			{/if}

			{#if currentStep < 3}
				<button type="button" class="btn btn-primary" on:click={nextStep} disabled={isNextDisabled}>
					Next
				</button>
			{:else}
				<button type="submit" class="btn btn-primary" disabled={isSaving}>
					{#if isSaving}
						<span class="loading loading-spinner"></span>
						{m.saving_button()}
					{:else}
						{m.save_dream_button()}
					{/if}
				</button>
			{/if}
		</div>
	</form>

	{#if form?.error}
		<div role="alert" class="mt-8 alert alert-error" transition:fade>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-6 w-6 shrink-0 stroke-current"
				fill="none"
				viewBox="0 0 24 24"
				><path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
				></path></svg
			>
			<span>{m.error_prefix()}: {form.error}</span>
		</div>
	{/if}
</div>
