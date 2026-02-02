import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString =
	process.env.DATABASE_URL || 'postgres://user:password@localhost:5434/dreamer';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function migrateTags() {
	console.log('Migrating existing tags to symbol graph...');

	const dreams = await prisma.dream.findMany({
		where: { tags: { not: Prisma.JsonNull } },
		select: { id: true, tags: true, createdAt: true }
	});

	console.log(`Found ${dreams.length} dreams with tags to migrate`);

	let migratedCount = 0;
	let symbolCount = 0;

	for (const dream of dreams) {
		const tags = (dream.tags as string[]) || [];

		for (const tagName of tags) {
			if (!tagName?.trim()) continue;

			const trimmedName = tagName.trim();

			// Upsert symbol
			const symbol = await prisma.symbol.upsert({
				where: { name: trimmedName },
				create: {
					name: trimmedName,
					occurrenceCount: 1,
					firstSeenAt: dream.createdAt
				},
				update: {
					occurrenceCount: { increment: 1 }
				}
			});

			// Create occurrence (skip if exists)
			await prisma.dreamSymbolOccurrence.upsert({
				where: {
					dreamId_symbolId: {
						dreamId: dream.id,
						symbolId: symbol.id
					}
				},
				create: {
					dreamId: dream.id,
					symbolId: symbol.id,
					sentiment: 'NEUTRAL',
					prominence: 2,
					contextNote: 'Migrated from legacy tag'
				},
				update: {}
			});

			migratedCount++;
			symbolCount++;
		}

		if (migratedCount % 100 === 0) {
			console.log(`  Progress: ${migratedCount} occurrences migrated...`);
		}
	}

	console.log(`\n✓ Migrated ${migratedCount} tag occurrences from ${dreams.length} dreams`);
	console.log(`✓ Created/updated ${symbolCount} unique symbols`);
}

migrateTags()
	.catch((error) => {
		console.error('Migration failed:', error);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
