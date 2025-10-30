<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import icon512 from '$lib/assets/icon-512x512.png'; // Import the icon

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
	<div class="hero bg-base-200 rounded-lg shadow-xl mb-8">
		<div class="hero-content text-center">
			<div class="max-w-md">
				<img src={icon512} alt={m.app_name()} class="mx-auto mb-4 w-32 h-32" /> <!-- Added icon -->
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
		<h2 class="text-4xl font-bold text-center mb-8">{m.how_it_works_title()}</h2>
		<ul class="steps steps-vertical lg:steps-horizontal w-full">
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
		<h2 class="text-4xl font-bold text-center mb-8">Features</h2>
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
