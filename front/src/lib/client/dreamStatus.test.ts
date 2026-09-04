import { describe, expect, it } from 'bun:test';
import { statusBadgeClass, statusTextClass } from './dreamStatus';

describe('dream status classes', () => {
	it('maps each status to its semantic colour', () => {
		expect(statusBadgeClass('COMPLETED')).toBe('badge-success');
		expect(statusBadgeClass('PENDING_ANALYSIS')).toBe('badge-info');
		expect(statusBadgeClass('ANALYSIS_FAILED')).toBe('badge-error');
	});

	it('keeps badge and text variants semantically aligned', () => {
		// The bug this replaced: PENDING_ANALYSIS was badge-info in two components
		// and text-warning in a third.
		for (const s of ['COMPLETED', 'PENDING_ANALYSIS', 'ANALYSIS_FAILED'] as const) {
			const badge = statusBadgeClass(s).replace('badge-', '');
			const text = statusTextClass(s).replace('text-', '');
			expect(badge).toBe(text);
		}
	});

	it('falls back to neutral for idle, unknown, null and undefined', () => {
		expect(statusBadgeClass('idle')).toBe('badge-neutral');
		expect(statusBadgeClass(null)).toBe('badge-neutral');
		expect(statusBadgeClass(undefined)).toBe('badge-neutral');
		expect(statusTextClass('idle')).toBe('text-base-content');
	});
});
