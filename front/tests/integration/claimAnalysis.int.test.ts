import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { PrismaClient, type DreamStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
	claimAnalysis,
	getCreditsBalance,
	releaseAnalysisClaim
} from '../../src/lib/server/credits';
import { resetServerEnvCache } from '../../src/lib/server/env';

/**
 * Exercises the real claimAnalysis against a real Postgres. These are the tests
 * that matter: two adversarial reviews found five ways to obtain a paid analysis
 * for free, and the assertions below are the ones that would have caught them.
 */

const prisma = new PrismaClient({
	adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
});

const users: string[] = [];

async function makeUser(credits: number, role: 'BASIC' | 'ADMIN' = 'BASIC') {
	const id = `claim_${Math.random().toString(36).slice(2, 10)}`;
	const u = await prisma.user.create({
		data: { username: id, email: `${id}@int.test`, passwordHash: 'x', role, credits }
	});
	users.push(u.id);
	return u;
}

async function makeDream(userId: string, status: DreamStatus = 'PENDING_ANALYSIS') {
	return prisma.dream.create({
		data: { userId, rawText: 'Un rêve de test pour claimAnalysis.', status }
	});
}

const ledgerFor = (dreamId: string) =>
	prisma.creditTransaction.findMany({
		where: { relatedDreamId: dreamId, actionType: 'DREAM_ANALYSIS' },
		select: { amount: true }
	});

const tokenOf = async (dreamId: string) =>
	(
		await prisma.dream.findUniqueOrThrow({
			where: { id: dreamId },
			select: { analysisPaidAt: true }
		})
	).analysisPaidAt;

beforeAll(async () => {
	// Grant less than the cap so credits can actually run out.
	process.env.DAILY_GRANT_BASIC = '0';
	resetServerEnvCache();
	await prisma.$queryRaw`SELECT 1`;
});

afterAll(async () => {
	if (users.length) {
		await prisma.creditTransaction.deleteMany({ where: { userId: { in: users } } });
		await prisma.dream.deleteMany({ where: { userId: { in: users } } });
		await prisma.user.deleteMany({ where: { id: { in: users } } });
	}
	delete process.env.DAILY_GRANT_BASIC;
	resetServerEnvCache();
	await prisma.$disconnect();
});

describe('claimAnalysis', () => {
	it('charges once, sets the token, and writes one ledger row', async () => {
		const u = await makeUser(10);
		const d = await makeDream(u.id);

		expect(await claimAnalysis(d, u.id, prisma)).toBe('charged');
		expect(await getCreditsBalance(u.id, prisma)).toBe(8);
		expect(await tokenOf(d.id)).not.toBeNull();
		expect(await ledgerFor(d.id)).toHaveLength(1);
	});

	it('refuses when the balance cannot cover it, leaving no trace', async () => {
		const u = await makeUser(1);
		const d = await makeDream(u.id);

		expect(await claimAnalysis(d, u.id, prisma)).toBe('insufficient');
		expect(await getCreditsBalance(u.id, prisma)).toBe(1);
		// The token must be released, or the dream is permanently unanalysable.
		expect(await tokenOf(d.id)).toBeNull();
		expect(await ledgerFor(d.id)).toHaveLength(0);
	});

	it('charges at most once under concurrent claims on one dream', async () => {
		const u = await makeUser(100);
		const d = await makeDream(u.id);

		const results = await Promise.all(
			Array.from({ length: 5 }, () => claimAnalysis(d, u.id, prisma))
		);

		expect(results.filter((r) => r === 'charged')).toHaveLength(1);
		expect(results.filter((r) => r === 'claimed-by-other')).toHaveLength(4);
		expect(await getCreditsBalance(u.id, prisma)).toBe(98);
		expect(await ledgerFor(d.id)).toHaveLength(1);
	});

	it('refuses to charge a user who does not own the dream', async () => {
		const owner = await makeUser(10);
		const other = await makeUser(10);
		const d = await makeDream(owner.id);

		expect(claimAnalysis(d, other.id, prisma)).rejects.toThrow();
		await Bun.sleep(50);
		expect(await getCreditsBalance(other.id, prisma)).toBe(10);
	});

	it('allows ONE free retry per charge, then charges again', async () => {
		// The exploit test. Cancel marks a run ANALYSIS_FAILED, so without a cap,
		// pay-once-then-cancel-repeatedly would be free forever.
		const u = await makeUser(10);
		const d = await makeDream(u.id);

		expect(await claimAnalysis(d, u.id, prisma)).toBe('charged');
		expect(await getCreditsBalance(u.id, prisma)).toBe(8);

		await releaseAnalysisClaim(d.id, prisma);
		const failed = { ...d, status: 'ANALYSIS_FAILED' as DreamStatus };

		expect(await claimAnalysis(failed, u.id, prisma)).toBe('free-retry');
		expect(await getCreditsBalance(u.id, prisma)).toBe(8);

		await releaseAnalysisClaim(d.id, prisma);
		expect(await claimAnalysis(failed, u.id, prisma)).toBe('charged');
		expect(await getCreditsBalance(u.id, prisma)).toBe(6);
	});

	it('releases the token so a terminated run does not entitle another', async () => {
		const u = await makeUser(10);
		const d = await makeDream(u.id);

		await claimAnalysis(d, u.id, prisma);
		expect(await tokenOf(d.id)).not.toBeNull();

		await releaseAnalysisClaim(d.id, prisma);
		expect(await tokenOf(d.id)).toBeNull();
	});

	it('grants the daily allowance before deciding affordability', async () => {
		process.env.DAILY_GRANT_BASIC = '6';
		resetServerEnvCache();

		// Zero balance and no grant yet today: the claim must grant, then succeed.
		const u = await makeUser(0);
		const d = await makeDream(u.id);

		expect(await claimAnalysis(d, u.id, prisma)).toBe('charged');
		expect(await getCreditsBalance(u.id, prisma)).toBe(4);

		process.env.DAILY_GRANT_BASIC = '0';
		resetServerEnvCache();
	});

	it('stops at the daily spend cap even with an ample balance', async () => {
		process.env.DAILY_LIMIT_BASIC = '4';
		resetServerEnvCache();

		const u = await makeUser(1000);
		const first = await makeDream(u.id);
		const second = await makeDream(u.id);
		const third = await makeDream(u.id);

		expect(await claimAnalysis(first, u.id, prisma)).toBe('charged');
		expect(await claimAnalysis(second, u.id, prisma)).toBe('charged');
		// 4 of 4 spent; the third must be refused rather than throwing.
		expect(await claimAnalysis(third, u.id, prisma)).toBe('insufficient');
		expect(await tokenOf(third.id)).toBeNull();

		delete process.env.DAILY_LIMIT_BASIC;
		resetServerEnvCache();
	});
});
