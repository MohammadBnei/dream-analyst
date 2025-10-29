<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import * as m from '$lib/paraglide/messages';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	const { isLoggedIn } = data;

</script>

<svelte:head>
	<link rel="icon" href={favicon} />
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
			<div class="mx-2 flex-1 px-2 text-xl font-bold">{m.app_name()}</div>
			<div class="hidden flex-none lg:block">
				<ul class="menu menu-horizontal">
					<!-- Navbar menu content here -->
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
						<!-- Theme switch toggle -->
						<label class="flex cursor-pointer gap-2">
							<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>
							<input type="checkbox" value="dark" class="toggle theme-controller" />
							<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
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
				<label class="flex cursor-pointer gap-2">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>
					<input type="checkbox" value="dark" class="toggle theme-controller" />
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
				</label>
			</li>
		</ul>
	</div>
</div>
