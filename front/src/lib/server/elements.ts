import type { Dream, PrismaClient } from '@prisma/client';
import * as v from 'valibot';
import { getPrismaClient } from '$lib/server/db';
import { getLLMService } from '$lib/server/llmService';
import { extractorModel, weakModel, matcherModel } from '$lib/server/settings';
import { extractorPrompt, matcherPrompt, annotationPrompt } from '$lib/server/prompts/elements';
import {
	ELEMENT_KINDS,
	normalizeLabel,
	type ElementKind,
	type RawElement
} from '$lib/elementKinds';

/**
 * Decomposing a dream into typed, canonicalised element rows.
 *
 * Two agents, on two different models: an extractor that names what is in the
 * dream, then a matcher that decides whether each name is something this dreamer
 * has used before. Everything here is FREE (never charges credits), converging-
 * idempotent, and safe to re-run over the whole corpus at any time - which is
 * what makes the taxonomy iterable, and is the quality attribute this whole
 * design is bent around.
 *
 * Nothing in this module touches `interpretation` or `analysisPaidAt`.
 */

/** Bounds a runaway extraction; also bounds cost per dream. */
const MAX_ELEMENTS_PER_DREAM = 20;

/**
 * Each agent gets its own budget rather than sharing one.
 *
 * A shared deadline makes the matcher the sacrificial call: a slow extractor
 * leaves it a second or two, it aborts, returns nothing, and the dream ends up
 * with zero elements having already paid for the extraction.
 */
const AGENT_TIMEOUT_MS = 10_000;

/**
 * Only the two fields an element cannot exist without. The scalars are
 * validated separately and on purpose: putting them in here would make valibot
 * reject the WHOLE object when a model hallucinates `valence: 9`, so one bad
 * number would discard a perfectly good symbol. Same reasoning as validating
 * per item rather than per array, one level down.
 */
const RawElementSchema = v.object({
	kind: v.picklist(ELEMENT_KINDS),
	label: v.pipe(v.string(), v.transform(normalizeLabel), v.minLength(1))
});

/** An in-range number, or undefined. Never throws, never poisons its element. */
function scalar(value: unknown, lo: number, hi: number): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) && value >= lo && value <= hi
		? value
		: undefined;
}

/**
 * Validate PER ITEM, never all-or-nothing: one hallucinated kind must not cost
 * the nine good elements sitting beside it, and one hallucinated scalar must not
 * cost the element carrying it.
 */
export function validateElements(parsed: unknown): RawElement[] {
	if (!Array.isArray(parsed)) return [];
	const out: RawElement[] = [];
	for (const item of parsed) {
		const r = v.safeParse(RawElementSchema, item);
		if (!r.success) continue;
		const raw = item as Record<string, unknown>;
		out.push({
			...r.output,
			valence: scalar(raw.valence, -1, 1),
			intensity: scalar(raw.intensity, 0, 1)
		});
		if (out.length >= MAX_ELEMENTS_PER_DREAM) break;
	}
	return out;
}

/**
 * Resolve the matcher's reply to candidate indices.
 *
 * The matcher answers with a LABEL, not a position, and this looks it up by
 * exact match on `(kind, normalised label)`. Both halves are load-bearing:
 *
 * - Positions do not survive a long candidate list. The spike watched a model
 *   merge `photo`, `clé`, `vitrine` and `feu` into `mer`, and split `père`
 *   across two entries, purely from miscounting rows.
 * - Kind is part of the key because with one flat list a `symbol` could
 *   otherwise land on an `emotion` entry, invisibly, since the UI groups by the
 *   entry's kind.
 *
 * Anything reworded, translated or invented fails the lookup and becomes a new
 * entry. That is the direction we want to fail in: a spurious new entry is
 * inert, a wrong merge is permanent and shows someone a symbol they never
 * dreamt.
 */
export function mapMatches(
	parsed: unknown,
	elements: RawElement[],
	candidates: { kind: string; label: string }[]
): Map<number, number> {
	const key = (kind: string, label: string) => `${kind}\u0000${normalizeLabel(label)}`;
	const byLabel = new Map<string, number>();
	candidates.forEach((c, i) => byLabel.set(key(c.kind, c.label), i));

	const out = new Map<number, number>();
	if (!Array.isArray(parsed)) return out;
	for (const p of parsed) {
		if (!p || typeof p !== 'object') continue;
		const { i, label } = p as { i?: unknown; label?: unknown };
		if (!Number.isInteger(i) || (i as number) < 0 || (i as number) >= elements.length) continue;
		if (out.has(i as number)) continue; // duplicate index: first answer wins
		if (typeof label !== 'string' || !label.trim()) continue;
		const idx = byLabel.get(key(elements[i as number].kind, label));
		if (idx !== undefined) out.set(i as number, idx);
	}
	return out;
}

/**
 * Collapse elements that resolved to the same vocabulary entry.
 *
 * This is NOT an edge case - it is the matcher's success case. `l'eau` and
 * `la mer` both landing on `mer` inside one dream is exactly what canonicalisation
 * is for, and `@@unique([dreamId, entryId])` turns it into a P2002 that rolls
 * back the entire replace transaction. So the better the matcher works, the more
 * often extraction would crash without this.
 *
 * For affect-carrying duplicates the stronger reading wins; note that the
 * surviving `rawLabel` is then that row's, not the first one's.
 */
export function dedupeByEntry<T extends { entryId: string; intensity?: number | null }>(
	rows: T[]
): T[] {
	const byEntry = new Map<string, T>();
	for (const row of rows) {
		const seen = byEntry.get(row.entryId);
		if (!seen) {
			byEntry.set(row.entryId, row);
			continue;
		}
		if ((row.intensity ?? -1) > (seen.intensity ?? -1)) byEntry.set(row.entryId, row);
	}
	return [...byEntry.values()];
}

/** Extractor agent. Never throws - a failure here is a no-op, by design. */
export async function extractElements(
	rawText: string,
	prisma: PrismaClient = getPrismaClient()
): Promise<RawElement[]> {
	try {
		const parsed = await getLLMService().generateJson(
			extractorPrompt(rawText),
			await extractorModel(prisma),
			AbortSignal.timeout(AGENT_TIMEOUT_MS)
		);
		return validateElements(parsed);
	} catch (e) {
		console.warn('elements: extraction failed', e);
		return [];
	}
}

type Candidate = { id: string; kind: string; label: string; also: string[] };

/**
 * Resolve each element to an existing vocabulary entry, or mark it new.
 *
 * EXACT MATCHES ARE RESOLVED IN CODE, NOT BY THE MODEL. `mer` -> `mer` is a Map
 * lookup; asking a model to do it was measurably worse in both directions, both
 * missing identical strings (producing duplicate `mer`, `père`, `grand-mère`
 * entries) and inventing merges. Only genuine ambiguity reaches the LLM, which
 * also roughly halves the candidate list it has to reason about.
 */
export async function resolveElements(
	userId: string,
	elements: RawElement[],
	prisma: PrismaClient = getPrismaClient()
): Promise<Map<number, string>> {
	const resolved = new Map<number, string>();
	if (!elements.length) return resolved;

	const vocabulary = await prisma.vocabularyEntry.findMany({
		where: { userId },
		select: { id: true, kind: true, label: true, occurrences: { select: { rawLabel: true } } }
	});

	const exact = new Map<string, string>();
	for (const e of vocabulary) exact.set(`${e.kind}\u0000${e.label}`, e.id);

	const unresolved: { idx: number; el: RawElement }[] = [];
	for (const [i, el] of elements.entries()) {
		const hit = exact.get(`${el.kind}\u0000${el.label}`);
		if (hit) resolved.set(i, hit);
		else unresolved.push({ idx: i, el });
	}
	if (!unresolved.length) return resolved;

	// Same-kind candidates only, for the kinds still in play. Deliberately NOT
	// capped by frequency: capping is self-reinforcing, because a symbol seen
	// twice a year ago falls below the cut and its next occurrence then creates a
	// second entry, pushing both further down. That buries precisely the
	// rare-but-recurring symbol this feature exists to surface.
	const kindsInPlay = new Set(unresolved.map((u) => u.el.kind));
	const candidates: Candidate[] = vocabulary
		.filter((e) => kindsInPlay.has(e.kind as ElementKind))
		.map((e) => ({
			id: e.id,
			kind: e.kind,
			label: e.label,
			also: [...new Set(e.occurrences.map((o) => o.rawLabel))].filter((r) => r !== e.label)
		}));

	if (candidates.length) {
		try {
			const sub = unresolved.map((u) => u.el);
			const parsed = await getLLMService().generateJson(
				matcherPrompt(sub, candidates),
				await matcherModel(prisma),
				AbortSignal.timeout(AGENT_TIMEOUT_MS)
			);
			for (const [subIdx, candIdx] of mapMatches(parsed, sub, candidates)) {
				resolved.set(unresolved[subIdx].idx, candidates[candIdx].id);
			}
		} catch (e) {
			console.warn('elements: matching failed, every unmatched element becomes new', e);
		}
	}

	// Everything still unresolved becomes a new entry. createMany + a read-back,
	// never upsert: Prisma 7's upsert is a read-modify-write query graph and
	// still races, which CLAUDE.md rules out. createMany DOES compile to
	// ON CONFLICT DO NOTHING, so a concurrent writer is absorbed rather than
	// raising P2002.
	const toCreate = new Map<string, { userId: string; kind: string; label: string }>();
	for (const { idx, el } of unresolved) {
		if (resolved.has(idx)) continue;
		toCreate.set(`${el.kind}\u0000${el.label}`, { userId, kind: el.kind, label: el.label });
	}
	if (toCreate.size) {
		await prisma.vocabularyEntry.createMany({ data: [...toCreate.values()], skipDuplicates: true });
		// Prisma has no tuple-IN, so an OR of pairs. `kind: {in}, label: {in}`
		// would be a cross-product and would map pairs that were never requested.
		const created = await prisma.vocabularyEntry.findMany({
			where: { userId, OR: [...toCreate.values()].map(({ kind, label }) => ({ kind, label })) },
			select: { id: true, kind: true, label: true }
		});
		const byKey = new Map(created.map((c) => [`${c.kind}\u0000${c.label}`, c.id]));
		for (const { idx, el } of unresolved) {
			if (resolved.has(idx)) continue;
			const id = byKey.get(`${el.kind}\u0000${el.label}`);
			if (id) resolved.set(idx, id);
		}
	}

	return resolved;
}

/**
 * Replace this dream's occurrence rows.
 *
 * The empty guard lives HERE, on the array actually being written, not in a
 * caller on the extractor's output. Extraction and matching each fail to `[]`
 * independently, and the matcher is the likelier of the two to fail because it
 * carries the candidate list - so guarding only the extractor would let a
 * matcher timeout silently delete every occurrence AND every post-pass note on
 * a dream the user may have just paid to re-analyse.
 */
export async function persistElements(
	dreamId: string,
	rows: { entryId: string; rawLabel: string; valence?: number; intensity?: number }[],
	prisma: PrismaClient = getPrismaClient()
): Promise<number> {
	const deduped = dedupeByEntry(rows);
	if (!deduped.length) return 0;

	// Notes survive a replace when the entry survives it.
	//
	// Re-extraction is the mechanism this whole design is bent around - the
	// taxonomy is expected to move, so `reextract` is meant to be run on a whim.
	// A plain delete-then-insert made that operation destroy every post-pass note
	// in the corpus, and nothing could rebuild them: annotateDream only runs off a
	// completed stream, so recovery meant re-charging every analysis. Re-attaching
	// by entry keeps the note whenever the image it describes is still there.
	const previousNotes = new Map(
		(
			await prisma.dreamElement.findMany({
				where: { dreamId, note: { not: null } },
				select: { entryId: true, note: true }
			})
		).map((r) => [r.entryId, r.note])
	);

	await prisma.$transaction([
		prisma.dreamElement.deleteMany({ where: { dreamId } }),
		prisma.dreamElement.createMany({
			data: deduped.map((r) => ({
				dreamId,
				entryId: r.entryId,
				rawLabel: r.rawLabel,
				valence: r.valence ?? null,
				intensity: r.intensity ?? null,
				note: previousNotes.get(r.entryId) ?? null
			})),
			skipDuplicates: true
		})
	]);
	return deduped.length;
}

/**
 * Extract, match and store this dream's elements. Free, idempotent, re-runnable.
 *
 * Never throws: the interpretation must stream whether or not this worked, and a
 * failed run is repaired for free by the next `reextract`.
 */
export async function extractDreamElements(
	dream: Pick<Dream, 'id' | 'userId' | 'rawText'>,
	prisma: PrismaClient = getPrismaClient()
): Promise<void> {
	try {
		const elements = await extractElements(dream.rawText, prisma);
		if (!elements.length) {
			// Still a completed attempt. Without this stamp a dream that legitimately
			// yields nothing looks un-extracted forever.
			await prisma.dream.update({
				where: { id: dream.id },
				data: { elementsExtractedAt: new Date() }
			});
			console.info(
				JSON.stringify({ msg: 'elements', dreamId: dream.id, extracted: 0, resolved: 0, stored: 0 })
			);
			return;
		}

		const resolved = await resolveElements(dream.userId, elements, prisma);
		const rows = [...resolved.entries()].map(([i, entryId]) => ({
			entryId,
			rawLabel: elements[i].label,
			valence: elements[i].valence,
			intensity: elements[i].intensity
		}));
		const stored = await persistElements(dream.id, rows, prisma);
		await prisma.dream.update({
			where: { id: dream.id },
			data: { elementsExtractedAt: new Date() }
		});

		// The one detector for the plan's #1 risk. Matcher failure is SILENT - it
		// throws nothing and writes well-formed rows either way - so a degraded
		// matcher shows up only as this ratio drifting. logger.ts already turns
		// console.* into JSON lines in production, so this is greppable.
		console.info(
			JSON.stringify({
				msg: 'elements',
				dreamId: dream.id,
				extracted: elements.length,
				resolved: resolved.size,
				stored
			})
		);
	} catch (e) {
		console.warn(`elements: extraction pipeline failed for dream ${dream.id}`, e);
	}
}

/**
 * Map the annotator's reply onto element rows by index.
 *
 * Keyed pairs, validated, same discipline as the matcher: a model that returns
 * fewer notes than elements would otherwise shift every attribution, and a note
 * about the sea would end up filed under the father. Exported for the test.
 */
export function mapNotes(parsed: unknown, count: number): Map<number, string> {
	const out = new Map<number, string>();
	if (!Array.isArray(parsed)) return out;
	for (const p of parsed) {
		if (!p || typeof p !== 'object') continue;
		const { i, note } = p as { i?: unknown; note?: unknown };
		if (!Number.isInteger(i) || (i as number) < 0 || (i as number) >= count) continue;
		if (out.has(i as number)) continue; // first answer wins
		if (typeof note !== 'string') continue;
		// Whitespace is collapsed for the same reason normalizeLabel collapses it,
		// one module away: this string is later spliced into a newline-delimited
		// bullet list inside the interpretation prompt. A note carrying newlines can
		// forge extra rows in that list - a fabricated symbol history, sourced from
		// text the dreamer wrote.
		const trimmed = note.replace(/\s+/g, ' ').trim().slice(0, 400);
		if (trimmed) out.set(i as number, trimmed);
	}
	return out;
}

/**
 * Write a short note per element saying what that image did in THIS dream.
 *
 * Runs detached, after the terminal write. Free, additive, re-runnable, and
 * deliberately incapable of affecting the analysis it describes:
 *
 * - It NEVER touches `interpretation` or `analysisPaidAt`.
 * - It writes with updateMany keyed on the row id, so if `resetAnalysis` has
 *   already replaced this dream's elements the write affects zero rows instead
 *   of throwing P2025 into a detached promise. New rows get fresh uuids, so a
 *   note from an abandoned run cannot attach itself to the next one.
 * - It gets its own timeout. Without one it inherits REQUEST_TIMEOUT_MS x
 *   maxRetries, which is roughly six minutes of detached, uncancellable work per
 *   completed analysis.
 *
 * Never throws.
 */
export async function annotateDream(
	dreamId: string,
	prisma: PrismaClient = getPrismaClient()
): Promise<void> {
	try {
		const dream = await prisma.dream.findUnique({
			where: { id: dreamId },
			select: {
				rawText: true,
				interpretation: true,
				elements: {
					select: { id: true, rawLabel: true, entry: { select: { kind: true, label: true } } }
				}
			}
		});

		// Gate on ELEMENTS, not on interpretation length: with no rows there is
		// nothing to annotate and the call would be pure spend.
		if (!dream?.interpretation || !dream.elements.length) return;

		const parsed = await getLLMService().generateJson(
			annotationPrompt(
				dream.rawText,
				dream.interpretation,
				dream.elements.map((e) => ({ kind: e.entry.kind, label: e.entry.label }))
			),
			await weakModel(prisma),
			AbortSignal.timeout(AGENT_TIMEOUT_MS)
		);

		const notes = mapNotes(parsed, dream.elements.length);
		if (!notes.size) return;

		await prisma.$transaction(
			[...notes].map(([i, note]) =>
				prisma.dreamElement.updateMany({ where: { id: dream.elements[i].id }, data: { note } })
			)
		);
		console.info(JSON.stringify({ msg: 'annotate', dreamId, notes: notes.size }));
	} catch (e) {
		console.warn(`elements: annotation failed for dream ${dreamId}`, e);
	}
}

/** A recurring element needs at least one PRIOR sighting, so tonight makes two. */
const MIN_OCCURRENCES_FOR_HISTORY = 2;

/** Enough to show a pattern, few enough that the block stays readable. */
const MAX_HISTORY_ENTRIES = 12;

/**
 * Below this, a shift is sampling noise rather than a trend.
 *
 * Paired with MIN_VALENCE_SAMPLES: a threshold alone does nothing at two
 * samples, because comparing one draw against one draw has no averaging in it -
 * two independent readings of the same image differ by this much routinely. The
 * prompt now tells the model "that change is usually the reading", so a
 * fabricated arc is not a cosmetic defect; it is the user being shown a history
 * they did not have.
 */
const VALENCE_SHIFT_THRESHOLD = 0.35;

/** Two per half. Fewer cannot distinguish a trend from two noisy draws. */
const MIN_VALENCE_SAMPLES = 4;

/**
 * Prior notes shown per image. Two is enough to establish that something has
 * changed without turning the block into a second dream journal.
 * ponytail: 12 entries x 2 notes x 200 chars caps this near 5k characters, which
 * sits alongside the 6k dream-text budget in analysis.ts. If both ever run full
 * at once, cap here first - the notes are the more compressible half.
 */
const MAX_NOTES_PER_ELEMENT = 2;
const NOTE_EXCERPT_CHARS = 200;

/**
 * The dreamer's own history with the symbols in tonight's dream.
 *
 * This is the deliverable the whole feature exists to produce - the thing that
 * makes an interpretation deeper rather than merely better indexed. It is pure
 * DB: no LLM call, no cost, no latency worth measuring.
 *
 * Scoped to the entries that appear in THIS dream. The model does not need the
 * user's whole vocabulary, it needs the history of what is in front of it, and
 * with singleton rates around 70% an unscoped list would be mostly noise.
 *
 * Only elements with a PRIOR sighting appear: a symbol seen once tonight is not
 * a pattern, and saying so invites the model to invent one.
 *
 * Note on the query: the plan assumed this needed $queryRaw, because Prisma's
 * groupBy cannot span models and the counts have to join `dreams` for
 * `dreamDate` (DreamElement.createdAt is row-insert time - after a reextract it
 * is uniformly "the hour the script ran"). A relation select plus aggregation in
 * JS does the same job at these row counts and stays readable, so the raw query
 * was not needed after all.
 */
export async function buildElementHistory(
	dream: Pick<Dream, 'id' | 'userId'>,
	prisma: PrismaClient = getPrismaClient()
): Promise<string> {
	try {
		const tonight = await prisma.dreamElement.findMany({
			where: { dreamId: dream.id },
			select: { entryId: true }
		});
		if (!tonight.length) return '';

		const rows = await prisma.dreamElement.findMany({
			where: { entryId: { in: tonight.map((t) => t.entryId) } },
			select: {
				entryId: true,
				valence: true,
				// The notes come back on the SAME read that produces the counts, so
				// feeding them to the interpreter costs one extra column and zero
				// extra calls. This is the cheapest quality win in the whole feature:
				// a count tells the model that an image recurs, a note tells it what
				// the image DID, which is the difference between something to
				// interpret and a frequency table to restate.
				note: true,
				dreamId: true,
				entry: { select: { kind: true, label: true } },
				dream: { select: { dreamDate: true } }
			}
		});

		type Agg = {
			kind: string;
			label: string;
			dates: Date[];
			valences: { at: Date; v: number }[];
			notes: { at: Date; note: string }[];
		};
		const byEntry = new Map<string, Agg>();
		for (const r of rows) {
			let agg = byEntry.get(r.entryId);
			if (!agg) {
				agg = { kind: r.entry.kind, label: r.entry.label, dates: [], valences: [], notes: [] };
				byEntry.set(r.entryId, agg);
			}
			agg.dates.push(r.dream.dreamDate);
			// Tonight's own reading is excluded, exactly as its note is: including it
			// makes the newest single draw the entire "after" half of the comparison.
			if (r.valence !== null && r.dreamId !== dream.id) {
				agg.valences.push({ at: r.dream.dreamDate, v: r.valence });
			}
			// Tonight's own row is excluded: it has no note yet (the post-pass runs
			// after the interpretation) and quoting the dream back at itself would
			// be noise.
			if (r.note && r.dreamId !== dream.id) {
				agg.notes.push({ at: r.dream.dreamDate, note: r.note });
			}
		}

		const lines = [...byEntry.values()]
			.filter((a) => a.dates.length >= MIN_OCCURRENCES_FOR_HISTORY)
			.sort((a, b) => b.dates.length - a.dates.length)
			.slice(0, MAX_HISTORY_ENTRIES)
			.map((a) => {
				const first = a.dates.reduce((m, d) => (d < m ? d : m));
				let line = `- ${a.label} (${a.kind}): ${a.dates.length} times since ${first.toLocaleDateString()}`;

				// An arc, not a number. A raw valence float from a temperature-0.7
				// model is false precision; the only honest reading is direction, and
				// only when the shift is bigger than the noise.
				if (a.valences.length >= MIN_VALENCE_SAMPLES) {
					const byDate = a.valences.slice().sort((x, y) => x.at.getTime() - y.at.getTime());
					const half = Math.floor(byDate.length / 2);
					const mean = (xs: { v: number }[]) => xs.reduce((n, x) => n + x.v, 0) / xs.length;
					const before = mean(byDate.slice(0, half));
					const after = mean(byDate.slice(half));
					const shift = after - before;
					if (Math.abs(shift) >= VALENCE_SHIFT_THRESHOLD) {
						line += shift < 0 ? ', and it has been darkening' : ', and it has been easing';
					}
				}

				// What this image actually did, the last couple of times it appeared.
				const recent = a.notes
					.slice()
					.sort((x, y) => y.at.getTime() - x.at.getTime())
					.slice(0, MAX_NOTES_PER_ELEMENT)
					.reverse();
				for (const n of recent) {
					const text =
						n.note.length > NOTE_EXCERPT_CHARS
							? `${n.note.slice(0, NOTE_EXCERPT_CHARS)}...`
							: n.note;
					line += `\n    - ${n.at.toLocaleDateString()}: ${text}`;
				}
				return line;
			});

		if (!lines.length) return '';
		return `Images I have dreamt before, and how often:\n${lines.join('\n')}`;
	} catch (e) {
		console.warn(`elements: history block failed for dream ${dream.id}`, e);
		return '';
	}
}

/**
 * Runs extraction only when a dream has none yet.
 *
 * The free, user-reachable repair path. Deliberately fill-only: unconditional
 * re-extraction on a free unlimited button would make it the costliest endpoint
 * in the app, and because extraction is delete-then-insert it would also destroy
 * post-pass notes the user paid for.
 */
export async function ensureDreamElements(
	dream: Pick<Dream, 'id' | 'userId' | 'rawText'>,
	prisma: PrismaClient = getPrismaClient()
): Promise<void> {
	// Latched on "was extraction ever attempted", NOT on "are there rows". A dream
	// whose extractor timed out, or which genuinely contains nothing worth
	// recording, holds zero rows forever - so a row count would let this free,
	// unlimited, unrate-limited button spend two model calls on it every click.
	const row = await prisma.dream.findUnique({
		where: { id: dream.id },
		select: { elementsExtractedAt: true }
	});
	if (!row?.elementsExtractedAt) await extractDreamElements(dream, prisma);
}
