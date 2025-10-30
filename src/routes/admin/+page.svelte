<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { UserRole } from '@prisma/client';

	const { data, form } = $props();

	let users = $derived(data.users);
	let userRoles = $derived(data.userRoles);

	let formMessage = $derived<string | null>(null);
	let formMessageType: 'success' | 'error' | null = null;

	// State for credit adjustment forms
	let creditAmount: { [key: string]: number } = $state({});
	let creditAction: { [key: string]: 'grant' | 'deduct' } = $state({});
	let isSubmittingCredits: { [key: string]: boolean } = $state({});

	// Effect to update local state when data from load function changes
	$effect(() => {
		if (data.users) {
			users = data.users;
			// Initialize credit form states for new users
			users.forEach((user) => {
				if (creditAmount[user.id] === undefined) creditAmount[user.id] = 1;
				if (creditAction[user.id] === undefined) creditAction[user.id] = 'grant';
				if (isSubmittingCredits[user.id] === undefined) isSubmittingCredits[user.id] = false;
			});
		}
	});

	// Effect to handle form submission responses
	$effect(() => {
		if (form) {
			if (form.success) {
				formMessage = form.message || 'Action successful!';
				formMessageType = 'success';
				invalidateAll(); // Invalidate all data to refresh user list and credits
			} else {
				formMessage = form.message || 'Action failed.';
				formMessageType = 'error';
			}
			// Reset submitting state for the specific user if applicable
			if (form.userId && isSubmittingCredits[form.userId]) {
				isSubmittingCredits[form.userId] = false;
			}
		}
	});

	function handleRoleChange(userId: string, event: Event) {
		const target = event.target as HTMLSelectElement;
		const newRole = target.value as UserRole;

		// Manually submit the form for role change
		const formData = new FormData();
		formData.append('userId', userId);
		formData.append('role', newRole);

		fetch('?/updateUserRole', {
			method: 'POST',
			body: formData
		})
			.then(async (response) => {
				const result = await response.json();
				if (result.success) {
					formMessage = result.message;
					formMessageType = 'success';
					invalidateAll();
				} else {
					formMessage = result.message;
					formMessageType = 'error';
				}
			})
			.catch((error) => {
				console.error('Error updating user role:', error);
				formMessage = 'An unexpected error occurred while updating role.';
				formMessageType = 'error';
			});
	}

	function handleCreditSubmit(userId: string) {
		isSubmittingCredits[userId] = true;
		formMessage = null; // Clear previous messages
	}
</script>

<div class="container mx-auto max-w-6xl p-4">
	<h1 class="mb-6 text-center text-3xl font-bold">{m.admin_dashboard_title()}</h1>

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

	<div class="overflow-x-auto">
		<table class="table w-full table-zebra">
			<thead>
				<tr>
					<th>{m.username_label()}</th>
					<th>{m.email_label()}</th>
					<th>{m.role_label()}</th>
					<th>{m.credits_label()}</th>
					<th>{m.daily_usage_label()}</th>
					<th>{m.actions_label()}</th>
				</tr>
			</thead>
			<tbody>
				{#each users as user (user.id)}
					<tr>
						<td>{user.username}</td>
						<td>{user.email}</td>
						<td>
							<select
								class="select-bordered select select-sm"
								value={user.role}
								onchange={(e) => handleRoleChange(user.id, e)}
							>
								{#each userRoles as role}
									<option value={role}>{role}</option>
								{/each}
							</select>
						</td>
						<td>{user.credits}</td>
						<td>{user.dailyUsage} / {user.dailyLimit}</td>
						<td>
							<form
								method="POST"
								action="?/updateUserCredits"
								use:enhance={() => {
									handleCreditSubmit(user.id);
									return async ({ update }) => {
										await update();
									};
								}}
								class="flex items-center gap-2"
							>
								<input type="hidden" name="userId" value={user.id} />
								<input
									type="number"
									name="amount"
									min="1"
									class="input-bordered input input-sm w-20"
									bind:value={creditAmount[user.id]}
									disabled={isSubmittingCredits[user.id]}
								/>
								<select
									name="action"
									class="select-bordered select select-sm"
									bind:value={creditAction[user.id]}
									disabled={isSubmittingCredits[user.id]}
								>
									<option value="grant">{m.grant_button()}</option>
									<option value="deduct">{m.deduct_button()}</option>
								</select>
								<button
									type="submit"
									class="btn btn-sm btn-primary"
									disabled={isSubmittingCredits[user.id]}
								>
									{#if isSubmittingCredits[user.id]}
										<span class="loading loading-spinner"></span>
									{:else}
										{m.submit_button()}
									{/if}
								</button>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
