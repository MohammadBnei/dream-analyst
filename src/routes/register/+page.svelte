<script lang="ts">
	import type { ActionData } from './$types';
	import * as m from '$lib/paraglide/messages';
	import { enhance } from '$app/forms';

	export let form: ActionData;
</script>

<div class="hero min-h-screen bg-base-200">
	<div class="hero-content flex-col lg:flex-row-reverse">
		<div class="text-center lg:text-left">
			<h1 class="text-5xl font-bold">{m.register_title()}</h1>
			<p class="py-6">
				{m.register_subtitle()}
			</p>
		</div>
		<div class="card w-full max-w-sm shrink-0 bg-base-100 shadow-2xl">
			<form method="POST" class="card-body" use:enhance>
				<div class="form-control">
					<label class="label" for="username">
						<span class="label-text">{m.username_label()}</span>
					</label>
					<input
						type="text"
						placeholder={m.username_label().toLowerCase()}
						class="input-bordered input"
						name="username"
						id="username"
						value={form?.username ?? ''}
						required
					/>
				</div>
				<div class="form-control">
					<label class="label" for="email">
						<span class="label-text">{m.email_label()}</span>
					</label>
					<input
						type="email"
						placeholder={m.email_label().toLowerCase()}
						class="input-bordered input"
						name="email"
						id="email"
						value={form?.email ?? ''}
						required
					/>
				</div>
				<div class="form-control">
					<label class="label" for="password">
						<span class="label-text">{m.password_label()}</span>
					</label>
					<input
						type="password"
						placeholder={m.password_label().toLowerCase()}
						class="input-bordered input"
						name="password"
						id="password"
						required
					/>
				</div>
				<div class="form-control">
					<label class="label" for="passwordConfirm">
						<span class="label-text">{m.password_confirm_label()}</span>
					</label>
					<input
						type="password"
						placeholder={m.password_confirm_label().toLowerCase()}
						class="input-bordered input"
						name="passwordConfirm"
						id="passwordConfirm"
						required
					/>
					<label class="label">
						<a href="/login" class="label-text-alt link link-hover">{m.have_account_link()}</a>
					</label>
				</div>
				{#if form?.message}
					<div role="alert" class="mt-4 alert alert-error">
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
							/></svg
						>
						<span>{form.message}</span>
					</div>
				{/if}
				<div class="form-control mt-6">
					<button type="submit" class="btn btn-primary">{m.register_button()}</button>
				</div>
			</form>
		</div>
	</div>
</div>
