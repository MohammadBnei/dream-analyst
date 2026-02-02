<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import Link from '../atoms/Link.svelte';
	import Button from '../atoms/Button.svelte';
	import Icon from '../atoms/Icon.svelte';
	import ThemeToggle from '../molecules/ThemeToggle.svelte';

	let {
		isLoggedIn = false,
		isAdmin = false,
		class: className = ''
	}: {
		isLoggedIn?: boolean;
		isAdmin?: boolean;
		class?: string;
	} = $props();
</script>

<div class={`navbar w-full bg-base-300 ${className}`}>
	<div class="flex-none lg:hidden">
		<label for="my-drawer-3" aria-label="open sidebar" class="btn btn-square btn-ghost">
			<Icon name="menu" />
		</label>
	</div>

	<div class="mx-2 flex-1 px-2 text-xl font-bold">
		<a href="/" class="btn text-xl btn-ghost">{m.app_name()}</a>
	</div>

	<div class="hidden flex-none lg:block">
		<ul class="menu menu-horizontal">
			{#if isLoggedIn}
				<li><Link href="/dreams">{m.dreams_link()}</Link></li>
				<li><Link href="/profile">{m.profile_link()}</Link></li>
				{#if isAdmin}
					<li><Link href="/admin">{m.admin_link()}</Link></li>
				{/if}
				<li>
					<form action="/logout" method="POST">
						<Button type="submit" variant="ghost">{m.logout_link()}</Button>
					</form>
				</li>
			{:else}
				<li><Link href="/login">{m.login_link()}</Link></li>
			{/if}
			<li>
				<ThemeToggle />
			</li>
		</ul>
	</div>
</div>
