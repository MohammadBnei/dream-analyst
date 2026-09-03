import { getPrismaClient } from '$lib/server/db';
import { serverEnv } from '$lib/server/env';
import type { PrismaClient, UserRole } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

/**
 * Credit accounting.
 *
 * Plain functions rather than a singleton class. The class held exactly one
 * piece of state - a Prisma client it constructed itself - which made the whole
 * module untestable: a test could not point it at a test database, so the
 * concurrency guarantees below had to be verified by RE-IMPLEMENTING the
 * transaction body in the test, which proved nothing about this code.
 *
 * Every function takes the client as an optional last argument. Call sites pass
 * nothing and get the app's client; tests pass their own.
 */

/** Thrown when a charge cannot proceed because of balance or daily limit. */
export class InsufficientCreditsError extends Error {
	readonly name = 'InsufficientCreditsError';
}

export type CreditAction = 'DREAM_ANALYSIS' | 'CHAT_MESSAGE';

/**
 * Read through serverEnv() rather than parseInt(env.X || 'default'): that form
 * silently produced NaN limits on a typo, and NaN comparisons are always false,
 * so a malformed limit disabled the check instead of failing.
 *
 * Functions, not constants: evaluating at module scope would validate the
 * environment at import time, which also happens during `vite build`.
 */
const creditCosts = (): Record<CreditAction, number> => {
	const e = serverEnv();
	return {
		DREAM_ANALYSIS: e.CREDIT_COST_DREAM_ANALYSIS,
		CHAT_MESSAGE: e.CREDIT_COST_CHAT_MESSAGE
	};
};

const dailyLimits = (): Record<UserRole, number> => {
	const e = serverEnv();
	return {
		BASIC: e.DAILY_LIMIT_BASIC,
		VIP: e.DAILY_LIMIT_VIP,
		ADMIN: e.DAILY_LIMIT_ADMIN
	};
};

/**
 * Day boundary in the server's local timezone. The spend window and grant
 * idempotency both key off this, so they stay consistent with each other.
 * ponytail: server-local, not per-user. Fine while the audience is one timezone.
 */
export function startOfToday(): Date {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	return d;
}

export const costOf = (action: CreditAction): number => creditCosts()[action];
export const dailyLimitFor = (role: UserRole): number => dailyLimits()[role];

/** Credits SPENT today. Always >= 0; grants do not count against a spend limit. */
export async function getDailyCreditUsage(
	userId: string,
	prisma: PrismaClient = getPrismaClient()
): Promise<number> {
	const spent = await prisma.creditTransaction.aggregate({
		where: { userId, createdAt: { gte: startOfToday() }, amount: { lt: 0 } },
		_sum: { amount: true }
	});
	return Math.abs(spent._sum.amount ?? 0);
}

export async function getCreditsBalance(
	userId: string,
	prisma: PrismaClient = getPrismaClient()
): Promise<number> {
	const user = await prisma.user.findUnique({ where: { id: userId }, select: { credits: true } });
	return user?.credits ?? 0;
}

/** Advisory read. deductCredits re-checks under a lock; this is for UI gating. */
export async function checkCredits(
	userId: string,
	amount: number,
	prisma: PrismaClient = getPrismaClient()
): Promise<boolean> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { credits: true, role: true }
	});
	if (!user) return false;
	if (user.role === 'ADMIN') return true;

	const dailyUsage = await getDailyCreditUsage(userId, prisma);
	if (dailyUsage + amount > dailyLimits()[user.role]) return false;

	return user.credits >= amount;
}

/**
 * Charges a user, atomically.
 *
 * The decrement is conditional on the balance covering it, and the daily-limit
 * check runs inside the same transaction behind a per-user advisory lock. The
 * previous version read the balance, computed `credits - amount` in application
 * code and wrote it back, with the limit check outside the transaction - so two
 * concurrent charges could both pass and drive the balance negative.
 *
 * pg_advisory_xact_lock returns void, which $queryRaw cannot deserialize; it has
 * to be $executeRaw.
 */
export async function deductCredits(
	userId: string,
	amount: number,
	actionType: CreditAction,
	relatedId?: string,
	prisma: PrismaClient = getPrismaClient()
): Promise<number> {
	if (amount <= 0) throw new Error('Deduction amount must be positive.');

	try {
		return await prisma.$transaction(async (tx) => {
			await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;

			const user = await tx.user.findUnique({ where: { id: userId }, select: { role: true } });
			if (!user) throw new Error('User not found.');

			if (user.role !== 'ADMIN') {
				const spent = await tx.creditTransaction.aggregate({
					where: { userId, createdAt: { gte: startOfToday() }, amount: { lt: 0 } },
					_sum: { amount: true }
				});
				const dailyUsage = Math.abs(spent._sum.amount ?? 0);
				const limit = dailyLimits()[user.role];
				if (dailyUsage + amount > limit) {
					throw new InsufficientCreditsError(
						`Daily credit limit exceeded. You have used ${dailyUsage}/${limit} credits today.`
					);
				}
			}

			const charged = await tx.user.updateMany({
				where: { id: userId, credits: { gte: amount } },
				data: { credits: { decrement: amount } }
			});
			if (charged.count !== 1) throw new InsufficientCreditsError('Insufficient credits.');

			const after = await tx.user.findUniqueOrThrow({
				where: { id: userId },
				select: { credits: true }
			});

			await tx.creditTransaction.create({
				data: {
					userId,
					amount: -amount,
					actionType,
					relatedDreamId: actionType === 'DREAM_ANALYSIS' ? relatedId : undefined,
					relatedChatMessageId: actionType === 'CHAT_MESSAGE' ? relatedId : undefined
				}
			});

			return after.credits;
		});
	} catch (error) {
		if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
			throw new Error('A credit transaction for this chat message already exists.', {
				cause: error
			});
		}
		console.error(`Failed to deduct credits for user ${userId}:`, error);
		throw error;
	}
}

/**
 * Grants the daily allowance at most once per user per day.
 *
 * A transaction-scoped advisory lock serialises the check and the insert. The
 * previous check-then-act allowed two concurrent callers to both grant, and
 * production contains two users who received a double grant. A unique index
 * would be the obvious guard, but those historical rows would block it from
 * being created, and deleting billing history to fit a constraint is the wrong
 * trade. It is called from login, from every profile page load, and from a
 * Promise.all over every user on every admin page load.
 */
export async function grantDailyCredits(
	userId: string,
	prisma: PrismaClient = getPrismaClient()
): Promise<number> {
	return prisma.$transaction(async (tx) => {
		await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;

		const user = await tx.user.findUnique({
			where: { id: userId },
			select: { role: true, credits: true }
		});
		if (!user) throw new Error('User not found.');

		const alreadyGranted = await tx.creditTransaction.count({
			where: { userId, actionType: 'DAILY_GRANT', createdAt: { gte: startOfToday() } }
		});
		if (alreadyGranted > 0) return user.credits;

		const amountToGrant = dailyLimits()[user.role];

		const updated = await tx.user.update({
			where: { id: userId },
			data: { credits: { increment: amountToGrant } },
			select: { credits: true }
		});
		await tx.creditTransaction.create({
			data: { userId, amount: amountToGrant, actionType: 'DAILY_GRANT' }
		});

		return updated.credits;
	});
}

/** Admin adjustment. Bypasses daily limits by design. */
export async function adminAdjustCredits(
	adminId: string,
	userId: string,
	amount: number,
	direction: 'grant' | 'deduct',
	reason?: string,
	prisma: PrismaClient = getPrismaClient()
): Promise<number> {
	if (amount <= 0) throw new Error('Amount must be positive.');

	const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
	if (!exists) throw new Error('User not found.');

	return prisma.$transaction(async (tx) => {
		const updated = await tx.user.update({
			where: { id: userId },
			data:
				direction === 'grant'
					? { credits: { increment: amount } }
					: { credits: { decrement: amount } },
			select: { credits: true }
		});

		await tx.creditTransaction.create({
			data: {
				userId,
				amount: direction === 'grant' ? amount : -amount,
				actionType: direction === 'grant' ? 'ADMIN_GRANT' : 'ADMIN_DEDUCT',
				adminId,
				notes: reason
			}
		});

		return updated.credits;
	});
}
