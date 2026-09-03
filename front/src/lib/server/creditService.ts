import { getPrismaClient } from '$lib/server/db';
import type { UserRole } from '@prisma/client'; // Import new enums
import { serverEnv } from '$lib/server/env';

/**
 * Thrown when a charge cannot proceed because of balance or daily limit.
 *
 * Callers used to detect this with `e.message.includes('Insufficient credits')`,
 * which silently stops working the moment anyone rewords the message.
 */
export class InsufficientCreditsError extends Error {
	readonly name = 'InsufficientCreditsError';
} // Import env
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

// Define credit costs and daily limits per role
// Read through serverEnv() rather than parseInt(env.X || 'default'): that form
// silently produced NaN limits on a typo'd value, and NaN comparisons are always
// false, so a malformed limit disabled the check instead of failing.
// Functions, not constants: evaluating at module scope would validate the
// environment at import time, which also happens during `vite build`.
const creditCosts = () => {
	const e = serverEnv();
	return {
		DREAM_ANALYSIS: e.CREDIT_COST_DREAM_ANALYSIS,
		CHAT_MESSAGE: e.CREDIT_COST_CHAT_MESSAGE
	};
};

/**
 * Day boundary in the server's local timezone. Both the spend window and grant
 * idempotency key off this, so they stay consistent with each other.
 * ponytail: server-local, not per-user. Fine while the audience is one timezone;
 * revisit if that stops being true.
 */
function startOfToday(): Date {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	return d;
}

const dailyLimits = (): Record<UserRole, number> => {
	const e = serverEnv();
	return {
		BASIC: e.DAILY_LIMIT_BASIC,
		VIP: e.DAILY_LIMIT_VIP,
		ADMIN: e.DAILY_LIMIT_ADMIN
	};
};

class CreditService {
	private prisma: ReturnType<typeof getPrismaClient>;

	constructor() {
		this.prisma = getPrismaClient();
	}

	/**
	 * Deducts credits from a user's balance and records a transaction.
	 * @param userId The ID of the user.
	 * @param amount The number of credits to deduct (should be positive).
	 * @param actionType The type of action causing the deduction.
	 * @param relatedId Optional: The ID of the related entity (e.g., Dream ID, ChatMessage ID).
	 * @returns The new credit balance.
	 * @throws Error if credits are insufficient or deduction fails.
	 */
	async deductCredits(
		userId: string,
		amount: number,
		actionType: 'DREAM_ANALYSIS' | 'CHAT_MESSAGE',
		relatedId?: string
	): Promise<number> {
		if (amount <= 0) {
			throw new Error('Deduction amount must be positive.');
		}

		try {
			const updatedUser = await this.prisma.$transaction(async (tx) => {
				// Serialise concurrent charges for this user, so the limit check below
				// cannot be overtaken between reading and writing.
				await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;

				const user = await tx.user.findUnique({
					where: { id: userId },
					select: { role: true }
				});
				if (!user) throw new Error('User not found.');

				// Inside the transaction now. It used to run before it, so the balance
				// could move between the check and the write.
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

				// Conditional decrement: the row is only updated when the balance can
				// cover it. Replaces a read-modify-write that had no `credits >= amount`
				// guard and no negative check, so concurrent charges could both pass and
				// drive the balance below zero.
				const charged = await tx.user.updateMany({
					where: { id: userId, credits: { gte: amount } },
					data: { credits: { decrement: amount } }
				});

				if (charged.count !== 1) {
					throw new InsufficientCreditsError('Insufficient credits.');
				}

				const after = await tx.user.findUniqueOrThrow({
					where: { id: userId },
					select: { credits: true }
				});

				await tx.creditTransaction.create({
					data: {
						userId: userId,
						amount: -amount, // Store as negative for deduction
						actionType: actionType,
						relatedDreamId: actionType === 'DREAM_ANALYSIS' ? relatedId : undefined,
						relatedChatMessageId: actionType === 'CHAT_MESSAGE' ? relatedId : undefined
					}
				});

				return after.credits;
			});
			return updatedUser;
		} catch (error) {
			if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
				// Handle unique constraint violation for relatedChatMessageId if it occurs
				console.error('Unique constraint violation for relatedChatMessageId:', error);
				throw new Error('A credit transaction for this chat message already exists.', {
					cause: error
				});
			}
			console.error(`Failed to deduct credits for user ${userId}:`, error);
			throw error;
		}
	}

	/**
	 * Allows an administrator to grant credits to a user.
	 * This bypasses daily limits and credit checks.
	 * @param userId The ID of the user.
	 * @param amount The number of credits to grant (should be positive).
	 * @param adminId The ID of the admin performing the action.
	 * @param reason Optional: A reason for the credit grant.
	 * @returns The new credit balance.
	 * @throws Error if the amount is not positive or user not found.
	 */
	async adminGrantCredits(
		adminId: string, // Added adminId
		userId: string,
		amount: number,
		reason?: string // Added reason
	): Promise<number> {
		if (amount <= 0) {
			throw new Error('Grant amount must be positive.');
		}

		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { id: true }
		});

		if (!user) {
			throw new Error('User not found.');
		}

		try {
			const updatedUser = await this.prisma.$transaction(async (tx) => {
				const newBalance = await tx.user.update({
					where: { id: userId },
					data: { credits: { increment: amount } },
					select: { credits: true }
				});

				await tx.creditTransaction.create({
					data: {
						userId: userId,
						amount: amount,
						actionType: 'ADMIN_GRANT',
						adminId: adminId, // Storing adminId
						notes: reason // Storing reason
					}
				});
				return newBalance.credits;
			});
			return updatedUser;
		} catch (error) {
			console.error(`Failed to admin grant credits for user ${userId}:`, error);
			throw error;
		}
	}

	/**
	 * Allows an administrator to deduct credits from a user.
	 * This bypasses daily limits and can result in negative credit balances.
	 * @param userId The ID of the user.
	 * @param amount The number of credits to deduct (should be positive).
	 * @param adminId The ID of the admin performing the action.
	 * @param reason Optional: A reason for the credit deduction.
	 * @returns The new credit balance.
	 * @throws Error if the amount is not positive or user not found.
	 */
	async adminDeductCredits(
		adminId: string, // Added adminId
		userId: string,
		amount: number,
		reason?: string // Added reason
	): Promise<number> {
		if (amount <= 0) {
			throw new Error('Deduction amount must be positive.');
		}

		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { id: true }
		});

		if (!user) {
			throw new Error('User not found.');
		}

		try {
			const updatedUser = await this.prisma.$transaction(async (tx) => {
				const newBalance = await tx.user.update({
					where: { id: userId },
					data: { credits: { decrement: amount } },
					select: { credits: true }
				});

				await tx.creditTransaction.create({
					data: {
						userId: userId,
						amount: -amount, // Store as negative for deduction
						actionType: 'ADMIN_DEDUCT',
						adminId: adminId, // Storing adminId
						notes: reason // Storing reason
					}
				});
				return newBalance.credits;
			});
			return updatedUser;
		} catch (error) {
			console.error(`Failed to admin deduct credits for user ${userId}:`, error);
			throw error;
		}
	}

	/**
	 * Checks if a user has sufficient credits for a given amount.
	 * @param userId The ID of the user.
	 * @param amount The amount of credits required.
	 * @returns True if credits are sufficient, false otherwise.
	 */
	async checkCredits(userId: string, amount: number): Promise<boolean> {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { credits: true, role: true }
		});

		if (!user) {
			return false;
		}

		if (user.role === 'ADMIN') {
			return true; // Admins always have enough credits
		}

		// Check daily limit
		const dailyUsage = await this.getDailyCreditUsage(userId);
		const limit = dailyLimits()[user.role];
		if (dailyUsage + amount > limit) {
			return false;
		}

		return user.credits >= amount;
	}

	/**
	 * Retrieves a user's credit usage for the current day.
	 * @param userId The ID of the user.
	 * @returns The total credits used today.
	 */
	/**
	 * Credits SPENT today. Always >= 0.
	 *
	 * This used to sum every transaction type for the day, including the positive
	 * DAILY_GRANT, and then negate the total when it came out positive. So a user
	 * who had just been granted 10 and spent nothing reported usage of -10, and the
	 * limit check `dailyUsage + amount > limit` became `-10 + 2 > 10` - false. Every
	 * user effectively got roughly double their intended daily cap.
	 *
	 * Only debits count against a spend limit, so restrict to negative amounts.
	 */
	async getDailyCreditUsage(userId: string): Promise<number> {
		const spent = await this.prisma.creditTransaction.aggregate({
			where: {
				userId,
				createdAt: { gte: startOfToday() },
				amount: { lt: 0 }
			},
			_sum: { amount: true }
		});

		return Math.abs(spent._sum.amount ?? 0);
	}

	/**
	 * Grants daily credits to a user based on their role.
	 * This method is idempotent for a given day.
	 * @param userId The ID of the user.
	 * @returns The new credit balance.
	 */
	/**
	 * Grants the daily allowance at most once per user per day.
	 *
	 * The previous implementation counted today's DAILY_GRANT rows and then
	 * inserted - a check-then-act with an await in the middle. Under READ COMMITTED
	 * two concurrent callers both saw zero and both granted. This is not
	 * theoretical: production contains two users who received a double grant
	 * (2025-10-30 and 2026-01-17). It is called from login, from every profile page
	 * load, and from a Promise.all over every user on every admin page load, so
	 * concurrent calls are routine.
	 *
	 * A transaction-scoped advisory lock serialises the check and the insert per
	 * user. Chosen over a unique index because the two historical duplicates would
	 * block the index from being created, and deleting billing history to make a
	 * constraint fit is the wrong trade.
	 */
	async grantDailyCredits(userId: string): Promise<number> {
		return this.prisma.$transaction(async (tx) => {
			// Held until this transaction ends. hashtextextended gives a stable
			// 64-bit key from the user id; the second argument namespaces it so it
			// cannot collide with an unrelated advisory lock.
			await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;

			const user = await tx.user.findUnique({
				where: { id: userId },
				select: { role: true, credits: true }
			});
			if (!user) throw new Error('User not found.');

			const alreadyGranted = await tx.creditTransaction.count({
				where: {
					userId,
					actionType: 'DAILY_GRANT',
					createdAt: { gte: startOfToday() }
				}
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

	/**
	 * Retrieves the current credit balance for a user.
	 * @param userId The ID of the user.
	 * @returns The current credit balance.
	 */
	async getCreditsBalance(userId: string): Promise<number> {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { credits: true }
		});
		return user?.credits || 0;
	}

	/**
	 * Returns the cost for a specific action type.
	 * @param actionType The type of action.
	 * @returns The credit cost.
	 */
	getCost(actionType: 'DREAM_ANALYSIS' | 'CHAT_MESSAGE'): number {
		return creditCosts()[actionType];
	}

	/**
	 * Returns the daily credit limit for a given user role.
	 * @param role The user's role.
	 * @returns The daily credit limit.
	 */
	getDailyLimit(role: UserRole): number {
		return dailyLimits()[role];
	}
}

let creditServiceInstance: CreditService;

export function getCreditService(): CreditService {
	if (!creditServiceInstance) {
		creditServiceInstance = new CreditService();
	}
	return creditServiceInstance;
}
