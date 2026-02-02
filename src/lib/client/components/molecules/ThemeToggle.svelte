<script lang="ts">
	import Icon from '../atoms/Icon.svelte';
	import { onMount } from 'svelte';

	let {
		class: className = ''
	}: {
		class?: string;
	} = $props();

	let currentTheme = $state('light');

	onMount(() => {
		const storedTheme = localStorage.getItem('theme');
		if (storedTheme) {
			currentTheme = storedTheme;
		} else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
			currentTheme = 'dark';
		}
		document.documentElement.setAttribute('data-theme', currentTheme);
	});

	function toggleTheme() {
		currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
		document.documentElement.setAttribute('data-theme', currentTheme);
		localStorage.setItem('theme', currentTheme);
	}
</script>

<label class={`swap swap-rotate ${className}`}>
	<input type="checkbox" onchange={toggleTheme} checked={currentTheme === 'dark'} />

	<Icon name="sun" class="swap-on fill-current" />
	<Icon name="moon" class="swap-off fill-current" />
</label>
