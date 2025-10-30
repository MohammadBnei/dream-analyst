import { getPrismaClient } from '$lib/server/db';
import type { UserRole, CreditActionType } from '@prisma/client'; // Import new enums
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

// Define credit costs and daily limits per role
const CREDIT_COSTS = {
    DREAM_ANALYSIS: 5, // Cost for one dream analysis
    CHAT_MESSAGE: 1,   // Cost for one AI chat message
};

const DAILY_CREDIT_LIMITS: Record<UserRole, number> = {
    BASIC: 10,
    VIP: 50,
    ADMIN: 999999, // Effectively unlimited
};

class CreditService {
    private prisma: Awaited<ReturnType<typeof getPrismaClient>>;

    constructor() {
        getPrismaClient().then(client => {
            this.prisma = client;
        });
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
        if (!this.prisma) {
            this.prisma = await getPrismaClient();
        }

        if (amount <= 0) {
            throw new Error('Deduction amount must be positive.');
        }

        // Check daily limit first
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, credits: true }
        });

        if (!user) {
            throw new Error('User not found.');
        }

        if (user.role !== 'ADMIN') { // Admins bypass daily limits
            const dailyUsage = await this.getDailyCreditUsage(userId);
            const limit = DAILY_CREDIT_LIMITS[user.role];
            if (dailyUsage + amount > limit) {
                throw new Error(`Daily credit limit exceeded. You have used ${dailyUsage}/${limit} credits today.`);
            }
        }

        // Perform deduction and record transaction in a single Prisma transaction
        try {
            const updatedUser = await this.prisma.$transaction(async (tx) => {
                const currentUser = await tx.user.findUnique({
                    where: { id: userId },
                    select: { credits: true }
                });

                if (!currentUser || currentUser.credits < amount) {
                    throw new Error('Insufficient credits.');
                }

                const newBalance = currentUser.credits - amount;

                await tx.user.update({
                    where: { id: userId },
                    data: { credits: newBalance }
                });

                await tx.creditTransaction.create({
                    data: {
                        userId: userId,
                        amount: -amount, // Store as negative for deduction
                        actionType: actionType,
                        relatedDreamId: actionType === 'DREAM_ANALYSIS' ? relatedId : undefined,
                        relatedChatMessageId: actionType === 'CHAT_MESSAGE' ? relatedId : undefined,
                    }
                });

                return newBalance;
            });
            return updatedUser;
        } catch (error) {
            if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
                // Handle unique constraint violation for relatedChatMessageId if it occurs
                console.error('Unique constraint violation for relatedChatMessageId:', error);
                throw new Error('A credit transaction for this chat message already exists.');
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
        userId: string,
        amount: number,
        adminId: string,
        reason?: string
    ): Promise<number> {
        if (!this.prisma) {
            this.prisma = await getPrismaClient();
        }

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
                        adminId: adminId,
                        notes: reason,
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
        userId: string,
        amount: number,
        adminId: string,
        reason?: string
    ): Promise<number> {
        if (!this.prisma) {
            this.prisma = await getPrismaClient();
        }

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
                        adminId: adminId,
                        notes: reason,
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
        if (!this.prisma) {
            this.prisma = await getPrismaClient();
        }
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
        const limit = DAILY_CREDIT_LIMITS[user.role];
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
    async getDailyCreditUsage(userId: string): Promise<number> {
        if (!this.prisma) {
            this.prisma = await getPrismaClient();
        }
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const transactions = await this.prisma.creditTransaction.aggregate({
            where: {
                userId: userId,
                createdAt: {
                    gte: startOfDay,
                },
                amount: {
                    lt: 0, // Only count deductions
                },
            },
            _sum: {
                amount: true,
            },
        });

        return Math.abs(transactions._sum.amount || 0);
    }

    /**
     * Grants daily credits to a user based on their role.
     * This method is idempotent for a given day.
     * @param userId The ID of the user.
     * @returns The new credit balance.
     */
    async grantDailyCredits(userId: string): Promise<number> {
        if (!this.prisma) {
            this.prisma = await getPrismaClient();
        }

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, credits: true }
        });

        if (!user) {
            throw new Error('User not found.');
        }

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        // Check if daily credits have already been granted today
        const alreadyGranted = await this.prisma.creditTransaction.count({
            where: {
                userId: userId,
                actionType: 'DAILY_GRANT',
                createdAt: {
                    gte: startOfDay,
                },
            },
        });

        if (alreadyGranted > 0) {
            return user.credits; // Credits already granted for today
        }

        const amountToGrant = DAILY_CREDIT_LIMITS[user.role]; // Grant credits up to the daily limit

        // Grant credits and record transaction
        const updatedUser = await this.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: userId },
                data: { credits: { increment: amountToGrant } }
            });

            await tx.creditTransaction.create({
                data: {
                    userId: userId,
                    amount: amountToGrant,
                    actionType: 'DAILY_GRANT',
                }
            });
            return (user.credits || 0) + amountToGrant;
        });

        return updatedUser;
    }

    /**
     * Retrieves the current credit balance for a user.
     * @param userId The ID of the user.
     * @returns The current credit balance.
     */
    async getCreditsBalance(userId: string): Promise<number> {
        if (!this.prisma) {
            this.prisma = await getPrismaClient();
        }
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
        return CREDIT_COSTS[actionType];
    }

    /**
     * Returns the daily credit limit for a given user role.
     * @param role The user's role.
     * @returns The daily credit limit.
     */
    getDailyLimit(role: UserRole): number {
        return DAILY_CREDIT_LIMITS[role];
    }
}

let creditServiceInstance: CreditService;

export function getCreditService(): CreditService {
    if (!creditServiceInstance) {
        creditServiceInstance = new CreditService();
    }
    return creditServiceInstance;
}
