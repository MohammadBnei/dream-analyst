<script lang="ts">
	type TextAreaSize = 'xs' | 'sm' | 'md' | 'lg';

	let {
		name,
		id,
		value = $bindable(''),
		placeholder = '',
		rows = 4,
		required = false,
		disabled = false,
		readonly = false,
		size = 'md',
		class: className = '',
		oninput
	}: {
		name?: string;
		id?: string;
		value?: string;
		placeholder?: string;
		rows?: number;
		required?: boolean;
		disabled?: boolean;
		readonly?: boolean;
		size?: TextAreaSize;
		class?: string;
		oninput?: (event: Event) => void;
	} = $props();

	const sizeClasses: Record<TextAreaSize, string> = {
		xs: 'textarea-xs',
		sm: 'textarea-sm',
		md: 'textarea-md',
		lg: 'textarea-lg'
	};

	const classes = $derived(
		['textarea', 'textarea-bordered', sizeClasses[size], className].filter(Boolean).join(' ')
	);
</script>

<textarea
	{name}
	{id}
	bind:value
	{placeholder}
	{rows}
	{required}
	{disabled}
	{readonly}
	class={classes}
	{oninput}
></textarea>
