<script lang="ts">
	let { status } = $props<{
		status: 'COMPLETED' | 'PENDING_ANALYSIS' | 'ANALYSIS_FAILED' | string;
	}>();

	// Function to determine badge color based on dream status
	function getStatusBadgeClass(status: string) {
		switch (status) {
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

<span class="badge {getStatusBadgeClass(status)}">{status.replace('_', ' ')}</span>
