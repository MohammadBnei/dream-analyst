<script lang="ts">
	export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'error' | 'warning' | 'success';
	export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

	let {
		type = 'button',
		variant = 'primary',
		size = 'md',
		disabled = false,
		loading = false,
		fullWidth = false,
		onclick,
		children,
		class: className = ''
	}: {
		type?: 'button' | 'submit' | 'reset';
		variant?: ButtonVariant;
		size?: ButtonSize;
		disabled?: boolean;
		loading?: boolean;
		fullWidth?: boolean;
		onclick?: (event: MouseEvent) => void;
		children: any;
		class?: string;
	} = $props();

	const variantClasses: Record<ButtonVariant, string> = {
		primary: 'btn-primary',
		secondary: 'btn-secondary',
		accent: 'btn-accent',
		ghost: 'btn-ghost',
		error: 'btn-error',
		warning: 'btn-warning',
		success: 'btn-success'
	};

	const sizeClasses: Record<ButtonSize, string> = {
		xs: 'btn-xs',
		sm: 'btn-sm',
		md: '',
		lg: 'btn-lg'
	};

	const classes = $derived(
		[
			'btn',
			variantClasses[variant],
			sizeClasses[size],
			fullWidth ? 'w-full' : '',
			className
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

<button {type} class={classes} disabled={disabled || loading} {onclick}>
	{#if loading}
		<span class="loading loading-spinner"></span>
	{/if}
	{@render children()}
</button>
