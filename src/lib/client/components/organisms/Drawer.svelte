<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import Link from '../atoms/Link.svelte';
	import Button from '../atoms/Button.svelte';
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

<div class={`drawer-side ${className}`}>
	<label for="my-drawer-3" aria-label="close sidebar" class="drawer-overlay"></label>
	<ul class="menu min-h-full w-80 bg-base-200 p-4">
		<li><Link href="/">{m.home_link()}</Link></li>
		{#if isLoggedIn}
			<li><Link href="/dreams">{m.dreams_link()}</Link></li>
			<li><Link href="/profile">{m.profile_link()}</Link></li>
			{#if isAdmin}
				<li><Link href="/admin">{m.admin_link()}</Link></li>
			{/if}
			<li>
				<form action="/logout" method="POST">
					<Button type="submit" variant="ghost" fullWidth>{m.logout_link()}</Button>
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
