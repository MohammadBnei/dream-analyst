import type { ElementKind } from '$lib/elementKinds';

/**
 * Kind -> daisyUI badge variant.
 *
 * One definition, deliberately. This map was duplicated byte-for-byte in
 * DreamElements and VocabularyStrip, which is the shape `dreamStatus.ts` was
 * created to stop: four copies of a status->class map that had drifted apart.
 */
const BADGE: Record<string, string> = {
	symbol: 'badge-primary',
	character: 'badge-secondary',
	setting: 'badge-accent',
	action: 'badge-info',
	emotion: 'badge-warning'
};

export function elementKindBadge(kind: ElementKind | string): string {
	return BADGE[kind] ?? 'badge-ghost';
}
