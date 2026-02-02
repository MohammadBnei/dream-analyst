<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import RichTextInput from '$lib/client/components/organisms/RichTextInput.svelte';
	import FormField from '$lib/client/components/molecules/FormField.svelte';
	import Button from '$lib/client/components/atoms/Button.svelte';
	import Alert from '$lib/client/components/atoms/Alert.svelte';
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
		<FormField
			label={m.what_did_you_dream_label()}
			name="dreamText"
			hint={m.minimum_characters_label({ count: 10 })}
		>
			<RichTextInput
				name="rawText"
				placeholder={m.describe_dream_placeholder()}
				rows={8}
				bind:value={dreamText}
			/>
		</FormField>

		<FormField label={m.life_context_label()} name="context" hint={m.life_context_description()}>
			<RichTextInput
				name="context"
				placeholder={m.life_context_placeholder()}
				bind:value={contextText}
			/>
		</FormField>

		<FormField
			label={m.emotional_landscape_label()}
			name="emotions"
			hint={m.emotional_landscape_description()}
		>
			<RichTextInput
				name="emotions"
				placeholder={m.emotional_landscape_placeholder()}
				bind:value={emotionsText}
			/>
		</FormField>

		<div class="mt-8 flex justify-end">
			<Button
				type="submit"
				variant="primary"
				size="lg"
				disabled={isSaving || isSubmitDisabled}
				loading={isSaving}
				class="w-full sm:w-auto"
			>
				{isSaving ? m.saving_button() : m.save_dream_button()}
			</Button>
		</div>
	</form>

	{#if form?.error}
		<div class="mt-8">
			<Alert variant="error">
				{m.error_prefix()}: {form.error}
			</Alert>
		</div>
	{/if}
</div>
