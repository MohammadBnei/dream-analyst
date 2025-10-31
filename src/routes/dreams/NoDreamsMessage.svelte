<script lang="ts">
	import * as m from '$lib/paraglide/messages';
</script>

<div class="hero rounded-box bg-base-200 p-8">
	<div class="hero-content text-center">
		<div class="max-w-md">
			<h2 class="mb-4 text-2xl font-bold">{m.no_dreams_recorded_title()}</h2>
			<p class="mb-5">{m.no_dreams_recorded_message()}</p>
			<a href="/dreams/new" class="btn btn-lg btn-primary">{m.add_new_dream_button()}</a>
		</div>
	</div>
</div>
