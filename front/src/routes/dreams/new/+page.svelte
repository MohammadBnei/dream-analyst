<script lang="ts">
	import { fade } from 'svelte/transition';
	import * as m from '$lib/paraglide/messages';
	import RichTextInput from '$lib/client/components/RichTextInput.svelte';
	import { enhance } from '$app/forms';

	export let form; // Data from form action

	let dreamText: string = form?.rawText || '';
	let isSaving: boolean = false;

	$: isSaveDisabled = dreamText.length < 10 || isSaving;

	function handleRichTextInput(value: string) {
		dreamText = value;
	}

	// Reset form after successful submission (handled by redirect) or on error
	$: if (form?.error) {
		isSaving = false;
	} else if (form?.success) {
		dreamText = ''; // Clear text on success
		isSaving = false;
	}
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
		class="space-y-6"
	>
		<div class="form-control">
			<label for="dreamText" class="label">
				<span class="label-text">{m.what_did_you_dream_label()}</span>
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

		<div class="flex justify-center">
			<button type="submit" class="btn btn-lg btn-primary" disabled={isSaveDisabled}>
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
