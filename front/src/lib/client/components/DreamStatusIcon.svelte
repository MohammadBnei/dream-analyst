<script lang="ts">
	import type { DisplayStatus } from '$lib/client/dreamStatus';

	/**
	 * Status glyph as real markup.
	 *
	 * DreamCard previously built these as template strings and injected them with
	 * {@html}, which was the only @html in the codebase and meant the SVGs carried
	 * no accessible name. Rendering them properly also lets the compiler check them.
	 */
	interface Props {
		status: DisplayStatus | null | undefined;
		/** Accessible label; omit to hide the icon from assistive tech. */
		label?: string;
	}

	let { status, label }: Props = $props();

	const PATHS: Record<string, { d: string; filled: boolean }> = {
		COMPLETED: {
			d: 'M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z',
			filled: true
		},
		PENDING_ANALYSIS: {
			d: 'M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l3 3a1 1 0 001.414-1.414L11 9.586V6z',
			filled: true
		},
		ANALYSIS_FAILED: {
			d: 'M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z',
			filled: true
		}
	};

	const icon = $derived(
		PATHS[status ?? ''] ?? { d: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', filled: false }
	);
</script>

{#if icon.filled}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		class="h-5 w-5"
		viewBox="0 0 20 20"
		fill="currentColor"
		role={label ? 'img' : 'presentation'}
		aria-label={label}
		aria-hidden={label ? undefined : 'true'}
	>
		<path fill-rule="evenodd" d={icon.d} clip-rule="evenodd" />
	</svg>
{:else}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		class="h-5 w-5"
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
		role={label ? 'img' : 'presentation'}
		aria-label={label}
		aria-hidden={label ? undefined : 'true'}
	>
		<path stroke-linecap="round" stroke-linejoin="round" d={icon.d} />
	</svg>
{/if}
