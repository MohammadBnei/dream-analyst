<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import dreamerLogo from '$lib/assets/dreamer-logo.png'; 
	import darkDreamerLogo from '$lib/assets/dark-dreamer-logo.png'; 

	// Assuming data will be passed from +page.server.ts, including user login status
	let { data } = $props();
</script>

<svelte:head>
	<title>{m.home_page_title()} - {m.app_name()}</title>
	<meta name="description" content={m.home_page_intro()} />
	<!-- Open Graph / Facebook -->
	<meta property="og:title" content={m.home_page_title()} />
	<meta property="og:description" content={m.home_page_intro()} />
	<!-- Twitter -->
	<meta property="twitter:title" content={m.home_page_title()} />
	<meta property="twitter:description" content={m.home_page_intro()} />
</svelte:head>

<div class="container mx-auto p-4">
	<div class="hero mb-8 rounded-lg bg-base-200 shadow-xl">
		<div class="hero-content flex-col lg:flex-row">
			<img src={dreamerLogo} alt={m.app_name()} class="max-w-sm rounded-lg shadow-2xl dark:hidden" />
			<img src={darkDreamerLogo} alt={m.app_name()} class="max-w-sm rounded-lg shadow-2xl hidden dark:block" />
			<!-- Adjusted icon size -->
			<div>
				<h1 class="text-5xl font-bold">{m.home_page_title()}</h1>
				<p class="py-6">
					{m.home_page_intro()}
				</p>
				{#if data.isLoggedIn}
					<a href="/dreams/new" class="btn btn-primary">{m.add_new_dream_button()}</a>
				{:else}
					<a href="/register" class="btn btn-primary">{m.register_button()}</a>
				{/if}
			</div>
		</div>
	</div>

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
