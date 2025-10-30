<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { enhance } from '$app/forms';

	let { onDeleteSuccess } = $props();

	let isDeleting = $state(false);
	let deleteError = $state<string | null>(null);

	async function handleDelete({ update }) {
		isDeleting = true;
		deleteError = null;
		await update();
		isDeleting = false;
		// The action will handle redirection, so we just need to close the modal
		const checkbox = document.getElementById('delete_dream_modal') as HTMLInputElement;
		if (checkbox) checkbox.checked = false;
		onDeleteSuccess(); // Notify parent that deletion was attempted
	}
</script>

<!-- Delete Confirmation Checkbox Modal -->
<input type="checkbox" id="delete_dream_modal" class="modal-toggle" />
<div class="modal" role="dialog">
	<div class="modal-box">
		<h3 class="text-lg font-bold">{m.confirm_deletion_title()}</h3>
		<p class="py-4">{m.confirm_deletion_message()}</p>
		{#if deleteError}
			<div class="mb-4 alert alert-error shadow-lg">
				<div>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6 flex-shrink-0 stroke-current"
						fill="none"
						viewBox="0 0 24 24"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
						></path></svg
					>
					<span>{deleteError}</span>
				</div>
			</div>
		{/if}
		<div class="modal-action">
			<label for="delete_dream_modal" class="btn btn-ghost" disabled={isDeleting}
				>{m.cancel_button()}</label
			>
			<form method="POST" action="?/deleteDream" use:enhance={handleDelete}>
				<button type="submit" class="btn btn-error" disabled={isDeleting}>
					{#if isDeleting}
						<span class="loading loading-spinner"></span>
						{m.deleting_button()}
					{:else}
						{m.delete_button()}
					{/if}
				</button>
			</form>
		</div>
	</div>
</div>
