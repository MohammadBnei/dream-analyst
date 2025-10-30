<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	const { data, form } = $props();

	let user = $derived(data.user);
	let dailyLimit = $state(data.dailyLimit);
	let dailyUsage = $state(data.dailyUsage);

	let editedUsername = $derived(user.username);
	let editedEmail = $derived(user.email);

	let isEditingUsername = $state(false);
	let isEditingEmail = $state(false);

	let usernameEditError = $state<string | null>(null);
	let emailEditError = $state<string | null>(null);
	let formMessage = $state<string | null>(null);
	let formMessageType: 'success' | 'error' | null = null;

	// Effect to handle form submission responses
	$effect(() => {
		if (form) {
			if (form.success) {
				formMessage = form.message || m.update_successful();
				formMessageType = 'success';
				// Invalidate all data to ensure header and other parts reflect new user info
				invalidateAll();
			} else {
				formMessage = form.message || m.update_failed();
				formMessageType = 'error';
			}

			// Reset specific edit errors
			if (form.username !== undefined) usernameEditError = form.message;
			if (form.email !== undefined) emailEditError = form.message;

			// Exit edit modes
			isEditingUsername = false;
			isEditingEmail = false;
		}
	});

	function toggleEditUsername() {
		isEditingUsername = !isEditingUsername;
		if (isEditingUsername) {
			editedUsername = user.username;
			usernameEditError = null;
		}
	}

	function toggleEditEmail() {
		isEditingEmail = !isEditingEmail;
		if (isEditingEmail) {
			editedEmail = user.email;
			emailEditError = null;
		}
	}

	function handleCancelUsernameEdit() {
		isEditingUsername = false;
		editedUsername = user.username;
		usernameEditError = null;
	}

	function handleCancelEmailEdit() {
		isEditingEmail = false;
		editedEmail = user.email;
		emailEditError = null;
	}

	function handleUsernameInput(event: Event) {
		editedUsername = (event.target as HTMLInputElement).value;
	}

	function handleEmailInput(event: Event) {
		editedEmail = (event.target as HTMLInputElement).value;
	}
</script>

<div class="container mx-auto max-w-2xl p-4">
	<h1 class="mb-6 text-center text-3xl font-bold">{m.profile_title()}</h1>

	{#if formMessage}
		<div
			role="alert"
			class="mb-4 alert {formMessageType === 'success' ? 'alert-success' : 'alert-error'}"
		>
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
			<span>{formMessage}</span>
		</div>
	{/if}

	<div class="card bg-base-100 p-6 shadow-xl">
		<div class="card-body p-0">
			<h2 class="mb-4 card-title text-2xl">{m.account_details_heading()}</h2>

			<div class="mb-4">
				<div class="mb-2 flex items-center justify-between">
					<p class="font-semibold">{m.username_label()}:</p>
					{#if !isEditingUsername}
						<button onclick={toggleEditUsername} class="btn btn-ghost btn-sm">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-5 w-5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
								/>
							</svg>
							{m.edit_button()}
						</button>
					{/if}
				</div>
				{#if isEditingUsername}
					<form
						method="POST"
						action="?/updateProfile"
						use:enhance={() => {
							formMessage = null; // Clear previous messages
							usernameEditError = null;
							return async ({ update }) => {
								await update();
							};
						}}
					>
						<input type="hidden" name="field" value="username" />
						<input
							type="text"
							name="username"
							class="input-bordered input w-full"
							bind:value={editedUsername}
							oninput={handleUsernameInput}
						/>
						{#if usernameEditError}
							<div class="mt-1 text-sm text-error">{usernameEditError}</div>
						{/if}
						<div class="mt-2 flex justify-end gap-2">
							<button onclick={handleCancelUsernameEdit} type="button" class="btn btn-ghost btn-sm"
								>{m.cancel_button()}</button
							>
							<button type="submit" class="btn btn-sm btn-primary">{m.save_button()}</button>
						</div>
					</form>
				{:else}
					<p class="text-lg">{user.username}</p>
				{/if}
			</div>

			<div class="mb-4">
				<div class="mb-2 flex items-center justify-between">
					<p class="font-semibold">{m.email_label()}:</p>
					{#if !isEditingEmail}
						<button onclick={toggleEditEmail} class="btn btn-ghost btn-sm">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-5 w-5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
								/>
							</svg>
							{m.edit_button()}
						</button>
					{/if}
				</div>
				{#if isEditingEmail}
					<form
						method="POST"
						action="?/updateProfile"
						use:enhance={() => {
							formMessage = null; // Clear previous messages
							emailEditError = null;
							return async ({ update }) => {
								await update();
							};
						}}
					>
						<input type="hidden" name="field" value="email" />
						<input
							type="email"
							name="email"
							class="input-bordered input w-full"
							bind:value={editedEmail}
							oninput={handleEmailInput}
						/>
						{#if emailEditError}
							<div class="mt-1 text-sm text-error">{emailEditError}</div>
						{/if}
						<div class="mt-2 flex justify-end gap-2">
							<button onclick={handleCancelEmailEdit} type="button" class="btn btn-ghost btn-sm"
								>{m.cancel_button()}</button
							>
							<button type="submit" class="btn btn-sm btn-primary">{m.save_button()}</button>
						</div>
					</form>
				{:else}
					<p class="text-lg">{user.email}</p>
				{/if}
			</div>

			<div class="mb-4">
				<p class="font-semibold">{m.role_label()}:</p>
				<p class="text-lg">{user.role}</p>
			</div>

			<div class="mb-4">
				<p class="font-semibold">{m.credits_label()}:</p>
				<p class="text-lg">{user.credits}</p>
			</div>

			<div class="mb-4">
				<p class="font-semibold">{m.daily_usage_label()}:</p>
				<p class="text-lg">{dailyUsage} / {dailyLimit}</p>
			</div>
		</div>
	</div>
</div>
