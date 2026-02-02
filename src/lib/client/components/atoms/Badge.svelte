<script lang="ts">
	type BadgeVariant =
		| 'neutral'
		| 'primary'
		| 'secondary'
		| 'accent'
		| 'info'
		| 'success'
		| 'warning'
		| 'error';
	type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';

	let {
		variant = 'neutral',
		size = 'md',
		outline = false,
		children,
		class: className = ''
	}: {
		variant?: BadgeVariant;
		size?: BadgeSize;
		outline?: boolean;
		children: any;
		class?: string;
	} = $props();

	const variantClasses: Record<BadgeVariant, string> = {
		neutral: 'badge-neutral',
		primary: 'badge-primary',
		secondary: 'badge-secondary',
		accent: 'badge-accent',
		info: 'badge-info',
		success: 'badge-success',
		warning: 'badge-warning',
		error: 'badge-error'
	};

	const sizeClasses: Record<BadgeSize, string> = {
		xs: 'badge-xs',
		sm: 'badge-sm',
		md: 'badge-md',
		lg: 'badge-lg'
	};

	const classes = $derived(
		[
			'badge',
			variantClasses[variant],
			sizeClasses[size],
			outline ? 'badge-outline' : '',
			className
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

<span class={classes}>
	{@render children()}
</span>
