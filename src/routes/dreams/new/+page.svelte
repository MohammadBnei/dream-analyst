<script lang="ts">
	import { fade } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import * as m from '$lib/paraglide/messages';
	import { createDream } from '$lib/remote/dream.remote';

	let dreamText: string = '';
	let isSaving: boolean = false;
	let errorMessage: string | null = null;

	$: isSaveDisabled = dreamText.length < 10 || isSaving;

	const submitForm = createDream(async ({ data, submit }) => {
		isSaving = true;
		errorMessage = null;

		try {
			const result = await submit();
			if (result.type === 'success') {
				const dreamId = result.data?.dreamId;
				if (dreamId) {
					await goto(`/dreams/${dreamId}`);
				} else {
					errorMessage = m.dream_saved_no_id_error();
				}
			} else if (result.type === 'error') {
				errorMessage = result.error?.message || m.unknown_error_occurred();
			} else if (result.type === 'failure') {
				errorMessage = result.data?.message || m.failed_to_save_dream();
			}
		} catch (e) {
			errorMessage = (e instanceof Error ? e.message : String(e)) || m.unknown_error_occurred();
		} finally {
			isSaving = false;
		}
	});

	function resetForm() {
		dreamText = '';
		isSaving = false;
		errorMessage = null;
	}
</script>

<div class="container mx-auto p-4 max-w-2xl">
	<h1 class="text-3xl font-bold mb-6 text-center">{m.new_dream_title()}</h1>

	<form method="POST" {...submitForm} class="space-y-6">
		<div class="form-control">
			<label for="dreamText" class="label">
				<span class="label-text">{m.what_did_you_dream_label()}</span>
			</label>
			<textarea
				id="dreamText"
				name="rawText"
				class="textarea textarea-bordered h-48 w-full"
				placeholder={m.describe_dream_placeholder()}
				bind:value={dreamText}
				required
				minlength="10"
			></textarea>
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
