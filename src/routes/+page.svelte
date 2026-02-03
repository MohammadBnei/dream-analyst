<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import dreamerLogo from '$lib/assets/dreamer-logo.png';
	import darkDreamerLogo from '$lib/assets/dark-dreamer-logo.png';
	import DashboardLayout from '$lib/client/components/dashboard/DashboardLayout.svelte';
	import QuickCaptureCard from '$lib/client/components/dashboard/QuickCaptureCard.svelte';
	import WeeklyInsightPanel from '$lib/client/components/dashboard/WeeklyInsightPanel.svelte';
	import RecurringSymbolsWidget from '$lib/client/components/dashboard/RecurringSymbolsWidget.svelte';
	import RecentActivityFeed from '$lib/client/components/dashboard/RecentActivityFeed.svelte';
	import DashboardStatsBar from '$lib/client/components/dashboard/DashboardStatsBar.svelte';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { creditStore } from '$lib/client/stores/creditStore';

	let { data } = $props();

	// PWA install handling
	let deferredPrompt: Event | null = $state(null);
	let showInstallButton = $state(false);

	if (browser) {
		window.addEventListener('appinstalled', () => {
			showInstallButton = false;
			console.log('PWA was installed');
		});
	}

	async function installPWA() {
		if (deferredPrompt) {
			(deferredPrompt as any).prompt();
			const { outcome } = await (deferredPrompt as any).userChoice;
			console.log(`User response to the install prompt: ${outcome}`);
			deferredPrompt = null;
			showInstallButton = false;
		}
	}

	// Initialize credit store for logged-in users
	onMount(() => {
		if (data.isLoggedIn && browser) {
			creditStore.init('current-user');
		}
	});

	// Transform dreams into activities for the feed
	const recentActivities = $derived(
		(data as any).recentDreams?.map((dream: any) => ({
			id: dream.id,
			type: 'dream' as const,
			title: dream.title || 'Untitled Dream',
			description: dream.rawText?.substring(0, 100) + '...',
			timestamp: dream.createdAt,
			dreamId: dream.id
		})) || []
	);
</script>

<svelte:head>
	<title>{m.home_page_title()} - {m.app_name()}</title>
	<meta name="description" content={m.home_page_intro()} />
	<meta property="og:title" content={m.home_page_title()} />
	<meta property="og:description" content={m.home_page_intro()} />
	<meta property="twitter:title" content={m.home_page_title()} />
	<meta property="twitter:description" content={m.home_page_intro()} />
</svelte:head>

<svelte:window
	onbeforeinstallprompt={(e) => {
		deferredPrompt = e;
		showInstallButton = true;
	}}
/>

{#if data.isLoggedIn}
	<!-- Dashboard View for Logged-In Users -->
	<div class="container mx-auto p-4">
		<!-- Page Title -->
		<div class="mb-6">
			<h1 class="text-4xl font-bold">Dream Analyst Pro</h1>
			<p class="mt-2 text-base-content/70">Welcome back to your dream command center</p>
		</div>

		<!-- Stats Bar -->
		<div class="mb-6">
			<DashboardStatsBar stats={(data as any).stats} />
		</div>

		<!-- Main Dashboard Layout -->
		<DashboardLayout>
			{#snippet leftSidebar()}
				<QuickCaptureCard />
				<RecentActivityFeed activities={recentActivities} />
			{/snippet}

			{#snippet mainContent()}
				<WeeklyInsightPanel insightData={(data as any).latestInsight} />
			{/snippet}

			{#snippet rightSidebar()}
				<RecurringSymbolsWidget symbols={(data as any).recurringSymbols} />
			{/snippet}
		</DashboardLayout>

		{#if showInstallButton}
			<div class="mt-8 text-center">
				<button onclick={installPWA} class="btn btn-lg btn-secondary"> Install App </button>
			</div>
		{/if}
	</div>
{:else}
	<!-- Landing Page for Non-Logged-In Users -->
	<div class="container mx-auto p-4">
		<div class="hero mb-8 rounded-lg bg-base-200 shadow-xl">
			<div class="hero-content flex-col lg:flex-row">
				<div class="w-full max-w-sm">
					<img src={dreamerLogo} alt={m.app_name()} class="rounded-lg shadow-2xl dark:hidden" />
					<img
						src={darkDreamerLogo}
						alt={m.app_name()}
						class="hidden rounded-lg shadow-2xl dark:block"
					/>
				</div>
				<div>
					<h1 class="text-5xl font-bold">{m.home_page_title()}</h1>
					<p class="py-6">
						{m.home_page_intro()}
					</p>
					<a href="/register" class="btn btn-primary">{m.register_button()}</a>
				</div>
			</div>
		</div>

		{#if showInstallButton}
			<section class="mb-8 text-center">
				<button onclick={installPWA} class="btn btn-lg btn-secondary"> Install App </button>
			</section>
		{/if}

		<section class="py-8">
			<h2 class="mb-8 text-center text-4xl font-bold">{m.how_it_works_title()}</h2>
			<ul class="steps steps-vertical w-full lg:steps-horizontal">
				<li class="step step-primary">
					<div class="text-lg font-semibold">{m.how_it_works_step_1()}</div>
				</li>
				<li class="step step-primary">
					<div class="text-lg font-semibold">{m.how_it_works_step_2()}</div>
				</li>
				<li class="step step-primary">
					<div class="text-lg font-semibold">{m.how_it_works_step_3()}</div>
				</li>
				<li class="step step-primary">
					<div class="text-lg font-semibold">{m.how_it_works_step_4()}</div>
				</li>
				<li class="step step-primary">
					<div class="text-lg font-semibold">{m.how_it_works_step_5()}</div>
				</li>
				<li class="step step-primary">
					<div class="text-lg font-semibold">{m.how_it_works_step_6()}</div>
				</li>
			</ul>
		</section>

		<section class="py-8">
			<h2 class="mb-8 text-center text-4xl font-bold">Features</h2>
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
				<div class="card bg-base-100 shadow-xl">
					<div class="card-body">
						<h3 class="card-title">{m.feature_dream_capture_title()}</h3>
						<p>{m.feature_dream_capture_description()}</p>
					</div>
				</div>
				<div class="card bg-base-100 shadow-xl">
					<div class="card-body">
						<h3 class="card-title">{m.feature_jungian_analysis_title()}</h3>
						<p>{m.feature_jungian_analysis_description()}</p>
					</div>
				</div>
				<div class="card bg-base-100 shadow-xl">
					<div class="card-body">
						<h3 class="card-title">{m.feature_tag_management_title()}</h3>
						<p>{m.feature_tag_management_description()}</p>
					</div>
				</div>
				<div class="card bg-base-100 shadow-xl">
					<div class="card-body">
						<h3 class="card-title">{m.feature_user_data_view_title()}</h3>
						<p>{m.feature_user_data_view_description()}</p>
					</div>
				</div>
				<div class="card bg-base-100 shadow-xl">
					<div class="card-body">
						<h3 class="card-title">{m.feature_visualization_title()}</h3>
						<p>{m.feature_visualization_description()}</p>
					</div>
				</div>
				<div class="card bg-base-100 shadow-xl">
					<div class="card-body">
						<h3 class="card-title">{m.feature_settings_title()}</h3>
						<p>{m.feature_settings_description()}</p>
					</div>
				</div>
			</div>
		</section>
	</div>
{/if}
