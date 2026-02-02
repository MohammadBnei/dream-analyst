<script lang="ts">
	let {
		href,
		external = false,
		underline = true,
		children,
		class: className = ''
	}: {
		href: string;
		external?: boolean;
		underline?: boolean;
		children: any;
		class?: string;
	} = $props();

	const classes = $derived(
		['link', underline ? 'link-hover' : '', className].filter(Boolean).join(' ')
	);

	const externalProps = external ? { target: '_blank', rel: 'noopener noreferrer' } : {};
</script>

<a {href} {...externalProps} class={classes}>
	{@render children()}
</a>
