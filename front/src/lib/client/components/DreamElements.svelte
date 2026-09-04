<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages';
	import { elementKindBadge } from '$lib/client/elementKindStyle';
	import { ELEMENT_KINDS, type ElementKind } from '$lib/elementKinds';

	type Element = {
		rawLabel: string;
		valence: number | null;
		note: string | null;
		entry: { id: string; kind: string; label: string };
	};

	let { elements = [], counts = {} } = $props<{
		elements?: Element[];
		/** entryId -> how many of this dreamer's dreams use it. */
		counts?: Record<string, number>;
	}>();

	// paraglide compiles messages to named exports, so `m[kind]()` is not
	// expressible and a kind needs a branch here as well as a key in both message
	// files. That is the honest cost of keeping `kind` a plain string rather than
	// a Postgres enum, and it is still the cheaper half of the trade.
	const kindLabel = (kind: string) =>
		({
			symbol: m.kind_symbol(),
			character: m.kind_character(),
			setting: m.kind_setting(),
			action: m.kind_action(),
			emotion: m.kind_emotion()
		})[kind] ?? kind;

	const grouped = $derived(
		ELEMENT_KINDS.map((kind: ElementKind) => ({
			kind,
			items: elements.filter((e: Element) => e.entry.kind === kind)
		})).filter((g) => g.items.length > 0)
	);

	// Notes are the only genuinely new prose this feature produces. They are
	// rendered as TEXT, never as a title attribute: a tooltip is invisible on
	// touch, unreachable by keyboard, and unreliably announced by screen readers.
	const noted = $derived(elements.filter((e: Element) => e.note));
</script>

<div class="mt-8 rounded-box bg-base-200 p-6 shadow-lg">
	<h2 class="mb-4 text-xl font-semibold">{m.symbols_heading()}</h2>

	{#if grouped.length === 0}
		<p class="text-sm text-base-content/70">{m.symbols_empty()}</p>
	{:else}
		{#each grouped as group (group.kind)}
			<div class="mb-3">
				<h3 class="mb-1 text-xs tracking-wide text-base-content/60 uppercase">
					{kindLabel(group.kind)}
				</h3>
				<div class="flex flex-wrap gap-2">
					{#each group.items as el (el.entry.id)}
						{@const count = counts[el.entry.id] ?? 1}
						<a
							class="badge {elementKindBadge(group.kind)} gap-1 badge-lg"
							href={resolve(`/dreams?element=${el.entry.id}`)}
							aria-label={m.filter_by_element({ label: el.entry.label })}
						>
							{el.entry.label}
							{#if count > 1}
								<span class="opacity-70">×{count}</span>
							{/if}
							{#if el.valence !== null}
								<!-- Direction only. A valence float from a 0.7-temperature model
								     is false precision; the sign is the only honest reading. -->
								<span aria-hidden="true">{el.valence < 0 ? '↓' : '↑'}</span>
							{/if}
						</a>
					{/each}
				</div>
			</div>
		{/each}

		{#if noted.length}
			<ul class="mt-4 space-y-1 border-t border-base-300 pt-3">
				{#each noted as el (el.entry.id)}
					<li class="text-sm text-base-content/80">
						<span class="font-medium">{el.entry.label}</span> — {el.note}
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>
