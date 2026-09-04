<script lang="ts">
	import { statusBadgeClass } from '$lib/client/dreamStatus';

	let { status } = $props();
</script>

<!-- The status-change form that used to live here posted to ?/updateStatus, an
     action whose picklist accepted PENDING_ANALYSIS - one POST minted a free
     analysis. It also had no submit control, so it never worked. Cancelling a
     stuck run is what /api/dreams/[id]/cancel-analysis is for. -->
<div class="flex items-center gap-2">
	<span class="badge {statusBadgeClass(status)}">{status?.replace('_', ' ')}</span>
</div>
