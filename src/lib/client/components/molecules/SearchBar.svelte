<script lang="ts">
	import Input from '../atoms/Input.svelte';
	import Button from '../atoms/Button.svelte';
	import Icon from '../atoms/Icon.svelte';

	let {
		value = $bindable(''),
		placeholder = '',
		onSearch,
		onReset,
		class: className = ''
	}: {
		value?: string;
		placeholder?: string;
		onSearch?: (query: string) => void;
		onReset?: () => void;
		class?: string;
	} = $props();

	function handleSubmit(e: Event) {
		e.preventDefault();
		onSearch?.(value);
	}

	function handleReset() {
		value = '';
		onReset?.();
	}

	const showReset = $derived(value.length > 0);
</script>

<form onsubmit={handleSubmit} class={`flex gap-2 ${className}`}>
	<div class="relative flex-1">
		<Input bind:value {placeholder} name="search" class="w-full pr-10" />
		{#if showReset}
			<button
				type="button"
				onclick={handleReset}
				class="btn btn-ghost btn-xs btn-circle absolute right-2 top-1/2 -translate-y-1/2"
			>
				<Icon name="close" size="sm" />
			</button>
		{/if}
	</div>
	<Button type="submit" variant="primary">
		<Icon name="search" size="sm" />
	</Button>
</form>
