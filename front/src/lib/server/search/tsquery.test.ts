import { describe, it, expect } from 'bun:test';
import { parseSearchTerms, buildTsQuery, buildTsQueryFromRaw } from './tsquery';

describe('parseSearchTerms', () => {
	it('splits on commas and whitespace and trims', () => {
		expect(parseSearchTerms('water, fire, mountain')).toEqual(['water', 'fire', 'mountain']);
	});

	it('collapses repeated separators and drops empties', () => {
		expect(parseSearchTerms('water,,  fire   ,mountain,')).toEqual(['water', 'fire', 'mountain']);
	});

	it('splits multi-word input into separate words (no phrase preservation here)', () => {
		// split() on whitespace means multi-word phrases are broken into words at this stage.
		expect(parseSearchTerms('dark forest, shame')).toEqual(['dark', 'forest', 'shame']);
	});

	it('returns an empty array for blank input', () => {
		expect(parseSearchTerms('')).toEqual([]);
		expect(parseSearchTerms('   ')).toEqual([]);
		expect(parseSearchTerms(',, , ,')).toEqual([]);
	});
});

describe('buildTsQuery', () => {
	it('OR-joins single-word terms', () => {
		expect(buildTsQuery(['water', 'fire', 'mountain'])).toBe('water | fire | mountain');
	});

	it('AND-joins the words inside a multi-word term, OR between terms', () => {
		expect(buildTsQuery(['dark forest', 'shame'])).toBe('dark & forest | shame');
	});

	it('strips tsquery operators / punctuation so it never produces a syntax error', () => {
		// The bug that caused the Postgres panic: raw operators / spaces reaching to_tsquery.
		expect(buildTsQuery(['fire & water', 'a|b', "it's", 'foo:bar'])).toBe(
			'fire & water | a & b | it & s | foo & bar'
		);
	});

	it('returns an empty string when there is nothing searchable', () => {
		expect(buildTsQuery([])).toBe('');
		expect(buildTsQuery(['', '   ', '!!!', '&&&'])).toBe('');
	});

	it('keeps unicode letters and digits (non-latin keywords)', () => {
		expect(buildTsQuery(['forêt sombre', 'ماء'])).toBe('forêt & sombre | ماء');
		expect(buildTsQuery(['dream42'])).toBe('dream42');
	});
});

describe('buildTsQueryFromRaw', () => {
	it('turns a raw comma-separated keyword list into a valid tsquery', () => {
		expect(buildTsQueryFromRaw('water,fire,mountain,shame')).toBe(
			'water | fire | mountain | shame'
		);
	});

	it('handles the LLM example output format', () => {
		expect(buildTsQueryFromRaw('water,fire,mountain,shame')).not.toContain(' ,');
		expect(buildTsQueryFromRaw('water,fire,mountain,shame')).not.toContain('mode');
	});

	it('never contains a bare space between two lexemes (which to_tsquery rejects)', () => {
		const q = buildTsQueryFromRaw('dark forest, deep ocean');
		// Every space must be part of a ' & ' or ' | ' operator, never "word word".
		expect(/[\p{L}\p{N}] [\p{L}\p{N}]/u.test(q)).toBe(false);
	});

	it('returns empty string for junk-only input so callers can skip the query', () => {
		expect(buildTsQueryFromRaw('   ,,, !!! ')).toBe('');
	});
});
