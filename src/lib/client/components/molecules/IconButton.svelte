<script lang="ts">
	import Button from '../atoms/Button.svelte';
	import Icon from '../atoms/Icon.svelte';
	import type { IconName, IconSize } from '../atoms/Icon.svelte';
	import type { ButtonVariant, ButtonSize } from '../atoms/Button.svelte';

	let {
		icon,
		iconSize = 'sm',
		variant = 'ghost',
		size = 'md',
		circle = false,
		square = false,
		tooltip,
		onclick,
		disabled = false,
		class: className = ''
	}: {
		icon: IconName;
		iconSize?: IconSize;
		variant?: ButtonVariant;
		size?: ButtonSize;
		circle?: boolean;
		square?: boolean;
		tooltip?: string;
		onclick?: (event: MouseEvent) => void;
		disabled?: boolean;
		class?: string;
	} = $props();

	const shapeClass = $derived(circle ? 'btn-circle' : square ? 'btn-square' : '');
	const buttonClass = $derived([shapeClass, className].filter(Boolean).join(' '));
</script>

<Button {variant} {size} {onclick} {disabled} class={buttonClass}>
	{#if tooltip}
		<span class="sr-only">{tooltip}</span>
	{/if}
	<Icon name={icon} size={iconSize} />
</Button>
