<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.ico';
	import * as m from '$lib/paraglide/messages';
	import type { LayoutProps } from './$types';
	import { onMount } from 'svelte';

	let { children, data }: LayoutProps = $props();

	const { isLoggedIn, lang, isAdmin } = data;

	let currentTheme: string;

	onMount(() => {
		// Initialize theme from localStorage or default to 'light'
		const storedTheme = localStorage.getItem('theme');
		if (storedTheme) {
			currentTheme = storedTheme;
		} else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
			currentTheme = 'dark';
		} else {
			currentTheme = 'light';
		}
		document.documentElement.setAttribute('data-theme', currentTheme);
		document.documentElement.lang = lang; // Set the lang attribute on mount
	});

	function toggleTheme() {
		currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
		document.documentElement.setAttribute('data-theme', currentTheme);
		localStorage.setItem('theme', currentTheme);
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="manifest" href="/manifest.json" />
	<meta name="theme-color" content="#3b82f6" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black" />
	<meta name="apple-mobile-web-app-title" content={m.app_name()} />
	<link rel="apple-touch-icon" href="/icon-192x192.png" />

	<!-- Open Graph / Facebook -->
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://dreamjournalai.com/" />
	<meta property="og:title" content={m.app_name()} />
	<meta property="og:description" content={m.app_description()} />
	<meta property="og:image" content="https://dreamjournalai.com/og-image.jpg" />

	<!-- Twitter -->
	<meta property="twitter:card" content="summary_large_image" />
	<meta property="twitter:url" content="https://dreamjournalai.com/" />
	<meta property="twitter:title" content={m.app_name()} />
	<meta property="twitter:description" content={m.app_description()} />
	<meta property="twitter:image" content="https://dreamjournalai.com/twitter-image.jpg" />
</svelte:head>

<div class="drawer">
	<input id="my-drawer-3" type="checkbox" class="drawer-toggle" />
	<div class="drawer-content flex min-h-screen flex-col">
		<!-- Navbar -->
		<div class="navbar w-full bg-base-300">
			<div class="flex-none lg:hidden">
				<label for="my-drawer-3" aria-label="open sidebar" class="btn btn-square btn-ghost">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						class="inline-block h-6 w-6 stroke-current"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 6h16M4 12h16M4 18h16"
						></path></svg
					>
				</label>
			</div>
			<div class="mx-2 flex-1 px-2 text-xl font-bold">
				<a href="/" class="btn text-xl btn-ghost">{m.app_name()}</a>
			</div>
			<div class="hidden flex-none lg:block">
				<ul class="menu menu-horizontal">
					<!-- Navbar menu content here -->
					{#if isLoggedIn}
						<li><a href="/dreams">{m.dreams_link()}</a></li>
						<li>
							<form action="/logout" method="POST">
								<button type="submit">{m.logout_link()}</button>
							</form>
						</li>
						<li><a href="/profile">{m.profile_link()}</a></li>
						{#if isAdmin}
							<li><a href="/admin">{m.admin_link()}</a></li>
						{/if}
					{:else}
						<li><a href="/login">{m.login_link()}</a></li>
						<li><a href="/register">{m.register_link()}</a></li>
					{/if}
					<li>
						<!-- Theme switch toggle -->
						<label class="swap swap-rotate">
							<!-- this hidden checkbox controls the state -->
							<input type="checkbox" onchange={toggleTheme} checked={currentTheme === 'dark'} />

							<!-- sun icon -->
							<svg
								class="swap-on h-6 w-6 fill-current"
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								><path
									d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM18.36,6.34a1,1,0,0,0-1.41-1.41l-.71.71a1,1,0,0,0,1.41,1.41ZM12,19a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM7.05,6.34l-.71-.71A1,1,0,0,0,5.64,7.05l.71.71A1,1,0,0,0,7.05,6.34ZM17.31,17l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,17.31,17ZM20,11H19a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-8-6a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V6A1,1,0,0,0,12,5Z"
								/></svg
							>

							<!-- moon icon -->
							<svg
								class="swap-off h-6 w-6 fill-current"
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								><path
									d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Z"
								/></svg
							>
						</label>
					</li>
				</ul>
			</div>
		</div>
		<!-- Page content here -->
		<main class="grow">
			{@render children()}
		</main>
	</div>
	<div class="drawer-side">
		<label for="my-drawer-3" aria-label="close sidebar" class="drawer-overlay"></label>
		<ul class="menu min-h-full w-80 bg-base-200 p-4">
			<!-- Sidebar content here -->
			<li><a href="/">{m.home_link()}</a></li>
			{#if isLoggedIn}
				<li><a href="/dreams">{m.dreams_link()}</a></li>
				<li>
					<form action="/logout" method="POST">
						<button type="submit">{m.logout_link()}</button>
					</form>
				</li>
			{:else}
				<li><a href="/login">{m.login_link()}</a></li>
				<li><a href="/register">{m.register_link()}</a></li>
			{/if}
			<li>
				<!-- Theme switch toggle for sidebar -->
				<label class="swap swap-rotate">
					<!-- this hidden checkbox controls the state -->
					<input type="checkbox" onchange={toggleTheme} checked={currentTheme === 'dark'} />

					<!-- sun icon -->
					<svg
						class="swap-on h-6 w-6 fill-current"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						><path
							d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM18.36,6.34a1,1,0,0,0-1.41-1.41l-.71.71a1,1,0,0,0,1.41,1.41ZM12,19a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM7.05,6.34l-.71-.71A1,1,0,0,0,5.64,7.05l.71.71A1,1,0,0,0,7.05,6.34ZM17.31,17l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,17.31,17ZM20,11H19a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-8-6a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V6A1,1,0,0,0,12,5Z"
						/></svg
					>

					<!-- moon icon -->
					<svg
						class="swap-off h-6 w-6 fill-current"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						><path
							d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Z"
						/></svg
					>
				</label>
			</li>
		</ul>
	</div>
</div>
