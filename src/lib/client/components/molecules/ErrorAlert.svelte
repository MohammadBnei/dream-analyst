<script lang="ts">
	import Alert from '../atoms/Alert.svelte';

	let {
		error = $bindable(null),
		class: className = ''
	}: {
		error?: string | null;
		class?: string;
	} = $props();

	function handleDismiss() {
		error = null;
	}
</script>

{#if error}
	<Alert variant="error" dismissible onDismiss={handleDismiss} class={className}>
		{error}
	</Alert>
{/if}
