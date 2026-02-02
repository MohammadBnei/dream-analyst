<script lang="ts">
	import { enhance } from '$app/forms';
	import * as m from '$lib/paraglide/messages';
	import { DreamState } from '$lib/types';

	type DreamStatus = 'COMPLETED' | 'PENDING_ANALYSIS' | 'ANALYSIS_FAILED' | 'STALLED';

	let { status, state = DreamState.CREATED } = $props<{ 
		status: DreamStatus; 
		state?: DreamState 
	}>();

	function getStatusBadgeClass(currentStatus: DreamStatus, currentState: DreamState) {
		if (currentState === DreamState.FAILED) return 'badge-error';
		if (currentState === DreamState.COMPLETED) return 'badge-success';
		
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

	function getStateLabel(currentState: DreamState) {
		switch (currentState) {
			case DreamState.CREATED:
				return 'Queued';
			case DreamState.ENRICHING:
				return 'Enriching context...';
			case DreamState.ENRICHING_REVISION:
				return 'Updating context...';
			case DreamState.INTERPRETING:
				return 'Analyzing...';
			case DreamState.INTERPRETING_REVISION:
				return 'Re-analyzing...';
			case DreamState.COMPLETED:
				return 'Analyzed';
			case DreamState.FAILED:
				return 'Analysis Failed';
			default:
				return currentState.replace('_', ' ');
		}
	}
</script>

<div class="flex items-center gap-2">
	<span class="badge {getStatusBadgeClass(status, state)}">
		{state && state !== DreamState.COMPLETED ? getStateLabel(state) : status?.replace('_', ' ')}
	</span>
	{#if status === 'PENDING_ANALYSIS'}
		<form method="POST" action="?/updateStatus" use:enhance>
			<select name="status" class="select-bordered select select-sm">
				<option value="" disabled selected>{m.change_status_option()}</option>
				<option value="ANALYSIS_FAILED">{m.reset_to_failed_analysis_option()}</option>
			</select>
		</form>
	{/if}
</div>
