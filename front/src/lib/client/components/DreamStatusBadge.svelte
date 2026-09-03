<script lang="ts">
	import { enhance } from '$app/forms';
	import * as m from '$lib/paraglide/messages';
	import { statusBadgeClass } from '$lib/client/dreamStatus';

	let { status } = $props();
</script>

<div class="flex items-center gap-2">
	<span class="badge {statusBadgeClass(status)}">{status?.replace('_', ' ')}</span>
	{#if status === 'PENDING_ANALYSIS'}
		<form method="POST" action="?/updateStatus" use:enhance>
			<select
				name="status"
				aria-label={m.aria_change_status()}
				class="select-bordered select select-sm"
			>
				<option value="" disabled selected>{m.change_status_option()}</option>
				<option value="ANALYSIS_FAILED">{m.reset_to_failed_analysis_option()}</option>
			</select>
		</form>
	{/if}
</div>
