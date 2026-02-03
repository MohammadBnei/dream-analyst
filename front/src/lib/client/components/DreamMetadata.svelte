<script lang="ts">
	import * as m from '$lib/paraglide/messages';

	let { createdAt, updatedAt } = $props();
</script>

<div class="mt-6 text-sm text-base-content/60">
	<p>{m.created_at_label({ date: new Date(createdAt).toLocaleString() })}</p>
	<p>{m.last_updated_at_label({ date: new Date(updatedAt).toLocaleString() })}</p>
</div>
