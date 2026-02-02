<script lang="ts">
	import { fade } from 'svelte/transition';
	import Icon from './Icon.svelte';

	type AlertVariant = 'info' | 'success' | 'warning' | 'error';

	let {
		variant = 'info',
		dismissible = false,
		onDismiss,
		children,
		class: className = ''
	}: {
		variant?: AlertVariant;
		dismissible?: boolean;
		onDismiss?: () => void;
		children: any;
		class?: string;
	} = $props();

	let visible = $state(true);

	const variantClasses: Record<AlertVariant, string> = {
		info: 'alert-info',
		success: 'alert-success',
		warning: 'alert-warning',
		error: 'alert-error'
	};

	const iconMap: Record<AlertVariant, 'info' | 'success' | 'warning' | 'error'> = {
		info: 'info',
		success: 'success',
		warning: 'warning',
		error: 'error'
	};

	const classes = $derived(['alert', variantClasses[variant], className].filter(Boolean).join(' '));

	function handleDismiss() {
		visible = false;
		onDismiss?.();
	}
</script>

{#if visible}
	<div role="alert" class={classes} transition:fade>
		<Icon name={iconMap[variant]} class="shrink-0 stroke-current" />
		<span>{@render children()}</span>
		{#if dismissible}
			<button onclick={handleDismiss} class="btn btn-ghost btn-sm btn-circle">
				<Icon name="close" size="sm" />
			</button>
		{/if}
	</div>
{/if}
