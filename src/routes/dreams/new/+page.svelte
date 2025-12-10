<script lang="ts">
	import { fade } from 'svelte/transition';
	import * as m from '$lib/paraglide/messages';
	import RichTextInput from '$lib/client/components/RichTextInput.svelte';
	import { enhance } from '$app/forms';

	let { form } = $props();

	let dreamText = $state((form?.rawText as string) || '');
	let contextText = $state((form?.context as string) || '');
	let emotionsText = $state((form?.emotions as string) || '');
	let isSaving = $state(false);

	let isSubmitDisabled = $derived(dreamText.length < 10);

	$effect(() => {
		if (form?.error) {
			isSaving = false;
			// Sync back values from server if they exist to preserve input
			if (form.rawText) dreamText = form.rawText.toString();
			if (form.context) contextText = form.context.toString();
			if (form.emotions) emotionsText = form.emotions.toString();
		} else if (form?.success) {
			dreamText = '';
			contextText = '';
			emotionsText = '';
			isSaving = false;
		}
	});
</script>

<div class="container mx-auto max-w-2xl p-4">
	<h1 class="mb-6 text-center text-3xl font-bold">{m.new_dream_title()}</h1>

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
		class="space-y-8"
	>
		<!-- Dream Section -->
		<div class="form-control w-full">
			<label for="dreamText" class="label">
				<span class="label-text text-lg font-semibold">{m.what_did_you_dream_label()}</span>
			</label>
			<RichTextInput
				name="rawText"
				placeholder={m.describe_dream_placeholder()}
				rows={8}
				bind:value={dreamText}
			/>
			<label class="label">
				<span class="label-text-alt text-base-content/60"
					>{m.minimum_characters_label({ count: 10 })}</span
				>
			</label>
		</div>

		<!-- Context Section -->
		<div class="form-control w-full">
			<label for="context" class="label">
				<span class="label-text text-lg font-semibold">{m.life_context_label()}</span>
			</label>
			<div class="mb-2 text-sm text-base-content/70">
				{m.life_context_description()}
			</div>
			<RichTextInput
				name="context"
				placeholder={m.life_context_placeholder()}
				bind:value={contextText}
			/>
		</div>

		<!-- Emotions Section -->
		<div class="form-control w-full">
			<label for="emotions" class="label">
				<span class="label-text text-lg font-semibold">{m.emotional_landscape_label()}</span>
			</label>
			<div class="mb-2 text-sm text-base-content/70">
				{m.emotional_landscape_description()}
			</div>
			<RichTextInput
				name="emotions"
				placeholder={m.emotional_landscape_placeholder()}
				bind:value={emotionsText}
			/>
		</div>

		<!-- Submit Button -->
		<div class="mt-8 flex justify-end">
			<button
				type="submit"
				class="btn w-full btn-lg btn-primary sm:w-auto"
				disabled={isSaving || isSubmitDisabled}
			>
				{#if isSaving}
					<span class="loading loading-spinner"></span>
					{m.saving_button()}
				{:else}
					{m.save_dream_button()}
				{/if}
			</button>
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
