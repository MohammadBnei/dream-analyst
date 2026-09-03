import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
	schema: 'prisma/schema.prisma',
	migrations: {
		path: 'prisma/migrations',
		seed: `bun run prisma/seed.ts`
	},
	datasource: {
		// Plain process.env, not prisma/config's env(): that helper THROWS on a
		// missing variable, so the `||` fallback below was unreachable and
		// `prisma generate` failed outright without a DATABASE_URL. Generate only
		// needs a syntactically valid URL - it never connects - so the fallback
		// keeps typecheck/lint runnable in CI and on a fresh clone.
		url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres'
	}
});
