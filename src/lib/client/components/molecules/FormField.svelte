<script lang="ts">
	let {
		label,
		name,
		required = false,
		hint,
		error,
		children
	}: {
		label?: string;
		name?: string;
		required?: boolean;
		hint?: string;
		error?: string;
		children: any;
	} = $props();

	const labelFor = name;
</script>

<div class="form-control w-full">
	{#if label}
		<label for={labelFor} class="label">
			<span class="label-text text-lg font-semibold">
				{label}
				{#if required}<span class="text-error">*</span>{/if}
			</span>
		</label>
	{/if}

	{@render children()}

	{#if hint || error}
		<label class="label">
			<span class="label-text-alt {error ? 'text-error' : 'text-base-content/60'}">
				{error || hint}
			</span>
		</label>
	{/if}
</div>
