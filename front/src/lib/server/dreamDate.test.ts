import { describe, it, expect } from 'bun:test';
import { isValidDreamDate, parseDreamDate } from './dreamDate';

describe('isValidDreamDate', () => {
	it('accepts a well-formed YYYY-MM-DD string', () => {
		expect(isValidDreamDate('2024-01-15')).toBe(true);
	});

	it('rejects empty string', () => {
		expect(isValidDreamDate('')).toBe(false);
	});

	it('rejects non-string values', () => {
		expect(isValidDreamDate(null)).toBe(false);
		expect(isValidDreamDate(undefined)).toBe(false);
		expect(isValidDreamDate(20240115)).toBe(false);
	});

	it('rejects unparseable strings', () => {
		expect(isValidDreamDate('not-a-date')).toBe(false);
		expect(isValidDreamDate('2024-13-40')).toBe(false);
	});
});

describe('parseDreamDate', () => {
	it('returns undefined for missing/empty/invalid input so Prisma default (now) applies', () => {
		expect(parseDreamDate('')).toBeUndefined();
		expect(parseDreamDate(null)).toBeUndefined();
		expect(parseDreamDate(undefined)).toBeUndefined();
		expect(parseDreamDate('nonsense')).toBeUndefined();
	});

	it('parses a YYYY-MM-DD string to UTC midnight (dreams are made the night before)', () => {
		const d = parseDreamDate('2024-01-15');
		expect(d).toBeInstanceOf(Date);
		expect(d!.toISOString()).toBe('2024-01-15T00:00:00.000Z');
	});

	it('round-trips back to the same YYYY-MM-DD via toISOString', () => {
		const input = '2023-12-31';
		const d = parseDreamDate(input);
		expect(d!.toISOString().split('T')[0]).toBe(input);
	});
});
