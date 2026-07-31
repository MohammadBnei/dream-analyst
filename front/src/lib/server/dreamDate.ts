/**
 * Helpers for the optional "dream date" supplied when creating a dream.
 *
 * A dream date comes from an <input type="date"> as a bare `YYYY-MM-DD` string.
 * We intentionally parse it with `new Date('YYYY-MM-DD')`, which yields UTC
 * midnight. This is the desired business behaviour: dreams are made the night
 * before, so anchoring to UTC midnight keeps the stored date consistent with how
 * the rest of the app (e.g. the detail page) reads and edits `dreamDate`.
 */

/** True when the value is a non-empty string that Date can parse. */
export function isValidDreamDate(value: unknown): boolean {
	if (typeof value !== 'string') return false;
	if (value === '') return false;
	return !isNaN(new Date(value).getTime());
}

/**
 * Normalise a raw form value into a Date to persist, or `undefined` when no
 * usable date was provided. Returning `undefined` lets Prisma fall back to the
 * schema default (`now()`).
 */
export function parseDreamDate(value: unknown): Date | undefined {
	if (!isValidDreamDate(value)) return undefined;
	return new Date(value as string);
}
