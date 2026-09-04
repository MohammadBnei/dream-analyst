import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { serverEnv } from '$lib/server/env';

let prisma: PrismaClient | undefined;

/**
 * Synchronous on purpose. This was previously `async` while never awaiting
 * anything, so two concurrent callers could each observe `!prisma` and construct
 * a separate PrismaClient with its own connection pool. Existing call sites still
 * `await` the result, which is harmless on a non-promise.
 *
 * The connection string used to be built as `${env.DATABASE_URL}`, which yielded
 * the literal string "undefined" when the variable was unset and passed that
 * straight to the driver. serverEnv() rejects it with a named error instead.
 */
export const getPrismaClient = (): PrismaClient => {
	if (!prisma) {
		prisma = new PrismaClient({
			adapter: new PrismaPg({ connectionString: serverEnv().DATABASE_URL })
		});
	}
	return prisma;
};
