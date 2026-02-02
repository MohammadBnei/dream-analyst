<script lang="ts">
	import type { ActionData } from './$types';
	import * as m from '$lib/paraglide/messages';
	import { enhance } from '$app/forms';
	import Input from '$lib/client/components/atoms/Input.svelte';
	import Button from '$lib/client/components/atoms/Button.svelte';
	import Alert from '$lib/client/components/atoms/Alert.svelte';
	import FormField from '$lib/client/components/molecules/FormField.svelte';

	export let form: ActionData;
</script>

<div class="hero min-h-screen bg-base-200">
	<div class="hero-content flex-col lg:flex-row-reverse">
		<div class="text-center lg:text-left">
			<h1 class="text-5xl font-bold">{m.login_title()}</h1>
			<p class="py-6">
				{m.login_subtitle()}
			</p>
		</div>
		<div class="card w-full max-w-sm shrink-0 bg-base-100 shadow-2xl">
			<form method="POST" class="card-body" use:enhance>
				<FormField label={m.username_or_email_label()} name="identity" required>
					<Input
						type="text"
						name="identity"
						id="identity"
						placeholder={m.username_or_email_label().toLowerCase()}
						value={form?.identity ?? ''}
						required
					/>
				</FormField>

				<FormField label={m.password_label()} name="password" required>
					<Input
						type="password"
						name="password"
						id="password"
						placeholder={m.password_label().toLowerCase()}
						required
					/>
					<div class="label">
						<a href="/register" class="label-text-alt link link-hover">{m.no_account_link()}</a>
					</div>
				</FormField>

				{#if form?.message}
					<Alert variant="error">
						{form.message}
					</Alert>
				{/if}

				<div class="form-control mt-6">
					<Button type="submit" variant="primary" fullWidth>
						{m.login_button()}
					</Button>
				</div>
			</form>
		</div>
	</div>
</div>
