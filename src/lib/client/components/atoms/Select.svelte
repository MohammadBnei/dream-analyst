<script lang="ts">
	type SelectSize = 'xs' | 'sm' | 'md' | 'lg';

	export interface SelectOption {
		value: string;
		label: string;
	}

	let {
		name,
		id,
		value = $bindable(''),
		options,
		size = 'md',
		required = false,
		disabled = false,
		class: className = '',
		onchange
	}: {
		name?: string;
		id?: string;
		value?: string;
		options: SelectOption[];
		size?: SelectSize;
		required?: boolean;
		disabled?: boolean;
		class?: string;
		onchange?: (event: Event) => void;
	} = $props();

	const sizeClasses: Record<SelectSize, string> = {
		xs: 'select-xs',
		sm: 'select-sm',
		md: 'select-md',
		lg: 'select-lg'
	};

	const classes = $derived(
		['select', 'select-bordered', sizeClasses[size], className].filter(Boolean).join(' ')
	);
</script>

<select {name} {id} bind:value {required} {disabled} class={classes} {onchange}>
	{#each options as option}
		<option value={option.value}>{option.label}</option>
	{/each}
</select>
