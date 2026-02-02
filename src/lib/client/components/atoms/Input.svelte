<script lang="ts">
	type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';
	type InputSize = 'xs' | 'sm' | 'md' | 'lg';

	let {
		type = 'text',
		size = 'md',
		name,
		id,
		value = $bindable(''),
		placeholder = '',
		required = false,
		disabled = false,
		readonly = false,
		autocomplete,
		class: className = '',
		oninput
	}: {
		type?: InputType;
		size?: InputSize;
		name?: string;
		id?: string;
		value?: string;
		placeholder?: string;
		required?: boolean;
		disabled?: boolean;
		readonly?: boolean;
		autocomplete?: string;
		class?: string;
		oninput?: (event: Event) => void;
	} = $props();

	const sizeClasses: Record<InputSize, string> = {
		xs: 'input-xs',
		sm: 'input-sm',
		md: 'input-md',
		lg: 'input-lg'
	};

	const classes = $derived(
		['input', 'input-bordered', sizeClasses[size], className].filter(Boolean).join(' ')
	);
</script>

<input
	{type}
	{name}
	{id}
	bind:value
	{placeholder}
	{required}
	{disabled}
	{readonly}
	autocomplete={autocomplete}
	class={classes}
	{oninput}
/>
