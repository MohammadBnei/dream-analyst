<script lang="ts">
	type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';
	type SpinnerVariant = 'spinner' | 'dots' | 'ring' | 'ball' | 'bars' | 'infinity';

	let {
		size = 'md',
		variant = 'spinner',
		class: className = ''
	}: {
		size?: SpinnerSize;
		variant?: SpinnerVariant;
		class?: string;
	} = $props();

	const sizeClasses: Record<SpinnerSize, string> = {
		xs: 'loading-xs',
		sm: 'loading-sm',
		md: 'loading-md',
		lg: 'loading-lg'
	};

	const variantClasses: Record<SpinnerVariant, string> = {
		spinner: 'loading-spinner',
		dots: 'loading-dots',
		ring: 'loading-ring',
		ball: 'loading-ball',
		bars: 'loading-bars',
		infinity: 'loading-infinity'
	};

	const classes = $derived(
		['loading', sizeClasses[size], variantClasses[variant], className].filter(Boolean).join(' ')
	);
</script>

<span class={classes}></span>
