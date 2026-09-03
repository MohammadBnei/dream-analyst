import type { DreamStatus } from '@prisma/client';

/** `idle` is a client-only state for an analysis that has not started. */
export type DisplayStatus = DreamStatus | 'idle';

/**
 * One semantic mapping for dream status, so the badge and text variants cannot
 * disagree.
 *
 * This existed four times with divergent results: PENDING_ANALYSIS rendered as
 * badge-info in DreamStatusBadge and StreamedAnalysisDisplay but text-warning in
 * DreamCard, so the same status was blue in one place and amber in another.
 * Settled on "info" - an analysis in progress is informational, not a warning.
 *
 * Full class names are written out rather than composed, so Tailwind's scanner
 * can see them.
 */
const SEMANTICS = {
	COMPLETED: { badge: 'badge-success', text: 'text-success' },
	PENDING_ANALYSIS: { badge: 'badge-info', text: 'text-info' },
	ANALYSIS_FAILED: { badge: 'badge-error', text: 'text-error' },
	idle: { badge: 'badge-neutral', text: 'text-base-content' }
} as const satisfies Record<DisplayStatus, { badge: string; text: string }>;

const semanticsFor = (status: DisplayStatus | null | undefined) =>
	SEMANTICS[status as DisplayStatus] ?? SEMANTICS.idle;

export const statusBadgeClass = (status: DisplayStatus | null | undefined) =>
	semanticsFor(status).badge;

export const statusTextClass = (status: DisplayStatus | null | undefined) =>
	semanticsFor(status).text;
