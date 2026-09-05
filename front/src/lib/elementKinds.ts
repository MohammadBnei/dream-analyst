/**
 * Browser-safe element kinds, mirroring `$lib/promptTypes` and existing for the
 * same reason: the UI groups badges by kind and must not import
 * `$lib/server/prompts/**` to learn the list.
 *
 * Kinds are a plain string in the database, not a Postgres enum, because the
 * taxonomy is expected to move during the test phase and adding one should be a
 * prompt edit rather than an ALTER TYPE. The honest cost of that choice: adding
 * a kind here also means a label in `messages/fr.json` AND `messages/en.json`,
 * plus a branch in the UI - paraglide compiles messages to named exports, so
 * `m[kind]()` is not expressible.
 */
export const ELEMENT_KINDS = ['symbol', 'character', 'setting', 'action', 'emotion'] as const;

export type ElementKind = (typeof ELEMENT_KINDS)[number];

/** One element as the extractor emits it, after validation and normalisation. */
export type RawElement = {
	kind: ElementKind;
	/** Already normalised: trimmed, lowercased, whitespace collapsed, <= 80 chars. */
	label: string;
	valence?: number;
	intensity?: number;
};

/**
 * Normalise a label before it is written or compared.
 *
 * The 80-char cap is load-bearing rather than cosmetic: this string is half a
 * btree unique key and an LLM writes it, so an unbounded value is an index-row
 * size error that would fail that dream's extraction on every future run.
 *
 * Case-folding and whitespace collapsing also remove a real share of
 * under-merging before the matcher is ever consulted - `Eau`, `eau` and `eau `
 * are one entry here rather than three.
 */
export function normalizeLabel(raw: string): string {
	return raw.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 80);
}
