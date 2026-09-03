import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
	checkCredits,
	deductCredits,
	getCreditsBalance,
	getDailyCreditUsage,
	grantDailyCredits,
	InsufficientCreditsError
} from '../../src/lib/server/credits';
import { resetServerEnvCache } from '../../src/lib/server/env';

/**
 * Exercises the REAL credit functions against a real Postgres.
 *
 * This could not be written before: getCreditService() was a singleton that
 * built its own Prisma client, so the earlier concurrency check had to
 * re-implement the transaction body and therefore proved nothing about the
 * shipped code. These call the actual implementation and pass it a client.
 */

const prisma = new PrismaClient({
	adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
});

const created: string[] = [];

async function makeUser(credits: number, role: 'BASIC' | 'ADMIN' = 'BASIC') {
	const id = `it_${Math.random().toString(36).slice(2, 10)}`;
	const u = await prisma.user.create({
		data: {
			username: id,
			email: `${id}@int.test`,
			passwordHash: 'x',
			role,
			credits
		}
	});
	created.push(u.id);
	return u;
}

beforeAll(async () => {
	await prisma.$queryRaw`SELECT 1`;
});

afterAll(async () => {
	if (created.length) {
		await prisma.creditTransaction.deleteMany({ where: { userId: { in: created } } });
		await prisma.user.deleteMany({ where: { id: { in: created } } });
	}
	await prisma.$disconnect();
});

describe('deductCredits', () => {
	it('charges once and returns the new balance', async () => {
		const u = await makeUser(10);
		expect(await deductCredits(u.id, 3, 'CHAT_MESSAGE', undefined, prisma)).toBe(7);
		expect(await getCreditsBalance(u.id, prisma)).toBe(7);
	});

	it('refuses to overdraw and leaves the balance untouched', async () => {
		const u = await makeUser(1);
		expect(deductCredits(u.id, 5, 'CHAT_MESSAGE', undefined, prisma)).rejects.toThrow(
			InsufficientCreditsError
		);
		await Bun.sleep(50);
		expect(await getCreditsBalance(u.id, prisma)).toBe(1);
	});

	it('never goes negative under concurrent charges', async () => {
		const u = await makeUser(1);
		const results = await Promise.allSettled(
			Array.from({ length: 5 }, () => deductCredits(u.id, 1, 'CHAT_MESSAGE', undefined, prisma))
		);
		const ok = results.filter((r) => r.status === 'fulfilled').length;

		expect(ok).toBe(1);
		expect(await getCreditsBalance(u.id, prisma)).toBe(0);
	});

	it('rejects a non-positive amount', async () => {
		const u = await makeUser(10);
		expect(deductCredits(u.id, 0, 'CHAT_MESSAGE', undefined, prisma)).rejects.toThrow();
		expect(deductCredits(u.id, -5, 'CHAT_MESSAGE', undefined, prisma)).rejects.toThrow();
	});

	it('enforces the daily limit even when the balance is ample', async () => {
		// serverEnv() caches its parse, so the limit must be changed before the
		// cache is populated for this assertion.
		process.env.DAILY_LIMIT_BASIC = '3';
		resetServerEnvCache();
		const u = await makeUser(1000);
		await deductCredits(u.id, 3, 'CHAT_MESSAGE', undefined, prisma);
		expect(deductCredits(u.id, 1, 'CHAT_MESSAGE', undefined, prisma)).rejects.toThrow(
			InsufficientCreditsError
		);

		delete process.env.DAILY_LIMIT_BASIC;
		resetServerEnvCache();
	});
});

describe('grantDailyCredits', () => {
	it('grants at most once per day under concurrency', async () => {
		const u = await makeUser(0);
		await Promise.all(Array.from({ length: 4 }, () => grantDailyCredits(u.id, prisma)));

		const grants = await prisma.creditTransaction.count({
			where: { userId: u.id, actionType: 'DAILY_GRANT' }
		});
		expect(grants).toBe(1);
	});
});

describe('getDailyCreditUsage', () => {
	it('counts spend only, never the grant', async () => {
		// The bug this replaced: grants were summed with charges and the total
		// negated, so a freshly granted user reported NEGATIVE usage and got roughly
		// double their cap.
		const u = await makeUser(0);
		await grantDailyCredits(u.id, prisma);
		await deductCredits(u.id, 2, 'CHAT_MESSAGE', undefined, prisma);

		const usage = await getDailyCreditUsage(u.id, prisma);
		expect(usage).toBe(2);
		expect(usage).toBeGreaterThanOrEqual(0);
	});
});

describe('checkCredits', () => {
	it('is false when the balance cannot cover the charge', async () => {
		const u = await makeUser(1);
		expect(await checkCredits(u.id, 5, prisma)).toBe(false);
	});

	it('is true for an admin regardless of balance', async () => {
		const u = await makeUser(0, 'ADMIN');
		expect(await checkCredits(u.id, 9999, prisma)).toBe(true);
	});

	it('is false for a user that does not exist', async () => {
		expect(await checkCredits('no-such-user', 1, prisma)).toBe(false);
	});
});
