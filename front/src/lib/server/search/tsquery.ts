/**
 * Helpers for building safe PostgreSQL full-text-search (`tsquery`) strings
 * for use with Prisma's `search` string filter.
 *
 * Prisma's `search` filter passes its value straight to Postgres' `to_tsquery`,
 * which has a strict grammar: bare whitespace between words is a syntax error,
 * and the `mode: 'insensitive'` option is NOT valid alongside `search` (it makes
 * the Prisma 7 query compiler fail with
 * "Could not convert from PrismaValue to String"). These helpers normalise raw,
 * user- or LLM-provided input into a valid tsquery so callers never emit either
 * of those failure modes.
 */

/**
 * Parse a raw comma/whitespace separated string of keywords into a list of
 * trimmed, non-empty terms. A term may itself contain multiple words
 * (e.g. "dark forest").
 */
export function parseSearchTerms(raw: string): string[] {
	return raw
		.split(/[,\s]+/)
		.map((term) => term.trim())
		.filter(Boolean);
}

/**
 * Build a valid Postgres `tsquery` string from a list of search terms.
 *
 * - Words within a single term are AND-ed together (` & `), so a multi-word
 *   phrase like "dark forest" becomes `dark & forest`.
 * - Distinct terms are OR-ed together (` | `).
 * - Any characters that are not word characters (letters, digits, underscore)
 *   are treated as word separators, so tsquery operators/punctuation coming
 *   from raw input can never produce a syntax error.
 *
 * Returns an empty string when there is nothing searchable; callers should
 * skip the query entirely in that case.
 */
export function buildTsQuery(terms: string[]): string {
	return terms
		.map((term) =>
			term
				.split(/[^\p{L}\p{N}_]+/u)
				.filter(Boolean)
				.join(' & ')
		)
		.filter(Boolean)
		.join(' | ');
}

/**
 * Convenience helper: parse a raw keyword string and build a tsquery in one step.
 */
export function buildTsQueryFromRaw(raw: string): string {
	return buildTsQuery(parseSearchTerms(raw));
}
