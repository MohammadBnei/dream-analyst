import '../src/lib/server/logger';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { extractDreamElements } from '../src/lib/server/elements';

/**
 * Re-run element extraction over a corpus.
 *
 * This exists because the taxonomy is expected to move. Changing a kind, a
 * prompt or the normalisation rules is worthless if the dreams already in the
 * database keep their old elements, so re-extraction has to be free, idempotent
 * and cheap enough to run on a whim. That is the whole reason extraction is kept
 * independent of the interpretation write and of the credit path.
 *
 * A WORKSTATION TOOL, NOT A POD TOOL. `.dockerignore` excludes `tests/`, where
 * the bun preload this script needs lives, so it cannot run inside the deployed
 * container. Point DATABASE_URL at the environment you mean and run it from a
 * checkout.
 *
 * Relative imports, never `$lib`: that alias resolves through the gitignored
 * `.svelte-kit/tsconfig.json`, so a `$lib` import here would silently require a
 * prior `svelte-kit sync`. migrate-deploy.ts sidesteps the same way.
 *
 *   bun run reextract                  # every dream
 *   bun run reextract <userId>         # one user
 *   bun run reextract --missing-only   # only dreams with no elements yet
 */

const args = process.argv.slice(2);
const MISSING_ONLY = args.includes('--missing-only');
const userId = args.find((a) => !a.startsWith('--'));

const url = process.env.DATABASE_URL;
if (!url) {
	console.error('DATABASE_URL is not set');
	process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const dreams = await prisma.dream.findMany({
	where: {
		...(userId ? { userId } : {}),
		// Keyed on the attempt, not on the rows. Keying it on `elements: { none: {} }`
		// leaked: every dream that legitimately extracts to zero stayed "missing"
		// and re-paid two model calls on every future run.
		...(MISSING_ONLY ? { elementsExtractedAt: null } : {})
	},
	// Oldest-first is mandatory, not cosmetic: the vocabulary has to grow
	// chronologically so later dreams match against an already-populated set.
	// Newest-first is the same code and a measurably worse vocabulary.
	orderBy: { dreamDate: 'asc' },
	select: { id: true, userId: true, rawText: true }
});

console.log(
	`reextract: ${dreams.length} dream(s)` +
		(userId ? ` for user ${userId}` : '') +
		(MISSING_ONLY ? ' (missing only)' : '')
);

for (const [i, dream] of dreams.entries()) {
	await extractDreamElements(dream, prisma);
	if ((i + 1) % 10 === 0 || i + 1 === dreams.length) {
		console.log(`reextract: ${i + 1}/${dreams.length}`);
	}
}

/**
 * The instrument.
 *
 * The step-0 spike defined a pass/fail on exactly these numbers and then
 * proposed deleting the script that computed them - keeping the thing being
 * measured and throwing away the measurement. Printing them here is what makes
 * one taxonomy iteration comparable to the next, and it is the only signal that
 * a degraded matcher produces, since matcher failure is otherwise silent: it
 * throws nothing and writes well-formed rows either way.
 */
const scope = userId ? { userId } : {};
const entries = await prisma.vocabularyEntry.findMany({
	where: scope,
	select: {
		kind: true,
		label: true,
		userId: true,
		_count: { select: { occurrences: true } }
	}
});

const occurrences = entries.reduce((n, e) => n + e._count.occurrences, 0);
const singletons = entries.filter((e) => e._count.occurrences === 1).length;
const pct = entries.length ? Math.round((singletons / entries.length) * 100) : 0;

console.log('\n===== VOCABULARY =====');
console.log(`dreams processed   ${dreams.length}`);
console.log(`occurrences        ${occurrences}`);
console.log(`total entries      ${entries.length}`);
console.log(`singletons         ${singletons} (${pct}%)`);

// Vocabulary is PER USER, so an unscoped run mixes people and the same label
// legitimately appears once per dreamer. Tag the owner rather than let the list
// read as duplicates.
const owners = new Set(entries.map((e) => e.userId));
if (!userId && owners.size > 1) {
	console.log(`spanning ${owners.size} users - pass a userId to read one vocabulary`);
}
console.log('\n----- top 30 by count -----');
for (const e of entries
	.slice()
	.sort((a, b) => b._count.occurrences - a._count.occurrences)
	.slice(0, 30)) {
	const who = !userId && owners.size > 1 ? `  (${e.userId.slice(0, 8)})` : '';
	console.log(
		`${String(e._count.occurrences).padStart(3)}  [${e.kind.padEnd(9)}] ${e.label}${who}`
	);
}

await prisma.$disconnect();
