<script lang="ts">
	import { fade } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import * as m from '$lib/paraglide/messages';
	import { createDream } from '$lib/remote/dream.remote';
    import RichTextInput from '$lib/client/components/RichTextInput.svelte'; // Import the new component

	let dreamText: string = '';
	let isSaving: boolean = false;
	let errorMessage: string | null = null;

	$: isSaveDisabled = dreamText.length < 10 || isSaving;

	async function handleSubmit() {
		isSaving = true;
		errorMessage = null;

		try {
			const result = await createDream({ rawText: dreamText });
			if (result && result.dreamId) {
				await goto(`/dreams/${result.dreamId}`);
			} else {
				errorMessage = m.dream_saved_no_id_error();
			}
		} catch (e: any) {
			// The remote function throws an error on failure, so catch it here.
			// The error object from SvelteKit's remote functions might have a 'message' property.
			errorMessage = e.body?.message || e.message || m.unknown_error_occurred();
		} finally {
			isSaving = false;
		}
	}

	function resetForm() {
		dreamText = '';
		isSaving = false;
		errorMessage = null;
	}

    function handleRichTextInput(value: string) {
        dreamText = value;
    }
</script>

<div class="container mx-auto p-4 max-w-2xl">
	<h1 class="text-3xl font-bold mb-6 text-center">{m.new_dream_title()}</h1>

	<form on:submit|preventDefault={handleSubmit} class="space-y-6">
		<div class="form-control">
			<label for="dreamText" class="label">
				<span class="label-text">{m.what_did_you_dream_label()}</span>
			</label>
            <RichTextInput
                id="dreamText"
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
			<button type="submit" class="btn btn-primary btn-lg" disabled={isSaveDisabled}>
				{#if isSaving}
					<span class="loading loading-spinner"></span>
					{m.saving_button()}
				{:else}
					{m.save_dream_button()}
				{/if}
			</button>
		</div>
	</form>

	{#if errorMessage}
		<div role="alert" class="alert alert-error mt-8" transition:fade>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="stroke-current shrink-0 h-6 w-6"
				fill="none"
				viewBox="0 0 24 24"
				><path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
				></path></svg
			>
			<span>{m.error_prefix()}: {errorMessage}</span>
			<button class="btn btn-sm btn-ghost" on:click={resetForm}>{m.retry_button()}</button>
		</div>
	{/if}
</div>
