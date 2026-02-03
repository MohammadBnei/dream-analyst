<script lang="ts">
	import { enhance } from '$app/forms';
	import * as m from '$lib/paraglide/messages';

	type DreamStatus = 'COMPLETED' | 'PENDING_ANALYSIS' | 'ANALYSIS_FAILED' | 'STALLED';

	let { status } = $props();

	function getStatusBadgeClass(currentStatus: DreamStatus) {
		switch (currentStatus) {
			case 'COMPLETED':
				return 'badge-success';
			case 'PENDING_ANALYSIS':
				return 'badge-info';
			case 'ANALYSIS_FAILED':
				return 'badge-error';
			default:
				return 'badge-neutral';
		}
	}
</script>

<div class="flex items-center gap-2">
	<span class="badge {getStatusBadgeClass(status)}">{status?.replace('_', ' ')}</span>
	{#if status === 'PENDING_ANALYSIS'}
		<form method="POST" action="?/updateStatus" use:enhance>
			<select name="status" class="select-bordered select select-sm">
				<option value="" disabled selected>{m.change_status_option()}</option>
				<option value="ANALYSIS_FAILED">{m.reset_to_failed_analysis_option()}</option>
			</select>
		</form>
	{/if}
</div>
