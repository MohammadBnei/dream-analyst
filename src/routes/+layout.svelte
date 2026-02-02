<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.ico';
	import * as m from '$lib/paraglide/messages';
	import type { LayoutProps } from './$types';
	import { onMount } from 'svelte';
	import Navbar from '$lib/client/components/organisms/Navbar.svelte';
	import Drawer from '$lib/client/components/organisms/Drawer.svelte';

	let { children, data }: LayoutProps = $props();

	const { isLoggedIn, lang, isAdmin } = data;

	onMount(() => {
		document.documentElement.lang = lang;
	});
</script>

<svelte:head>
	<title>Dreamer</title>
	<link rel="icon" href={favicon} />
	<link rel="manifest" href="/manifest.json" />
	<meta name="theme-color" content="#3b82f6" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black" />
	<meta name="apple-mobile-web-app-title" content={m.app_name()} />
	<link rel="apple-touch-icon" href="/icon-192x192.png" />

	<!-- Open Graph / Facebook -->
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://dreamer.bnei.dev/" />
	<meta property="og:title" content={m.app_name()} />
	<meta property="og:description" content={m.app_description()} />
	<meta property="og:image" content="https://dreamer.bnei.dev/og-image.jpg" />

	<!-- Twitter -->
	<meta property="twitter:card" content="summary_large_image" />
	<meta property="twitter:url" content="https://dreamer.bnei.dev/" />
	<meta property="twitter:title" content={m.app_name()} />
	<meta property="twitter:description" content={m.app_description()} />
	<meta property="twitter:image" content="https://dreamer.bnei.dev/twitter-image.jpg" />
</svelte:head>

<div class="drawer">
	<input id="my-drawer-3" type="checkbox" class="drawer-toggle" />
	<div class="drawer-content flex min-h-screen flex-col">
		<Navbar {isLoggedIn} {isAdmin} />
		<main class="grow">
			{@render children()}
		</main>
	</div>
	<Drawer {isLoggedIn} {isAdmin} />
</div>
