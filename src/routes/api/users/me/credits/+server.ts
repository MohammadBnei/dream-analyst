import { json } from '@sveltejs/kit';
import { creditService } from '$lib/server/creditService';
import { getPrismaClient } from '$lib/server/db';
import type { RequestHandler } from './$types';

/**
 * GET /api/users/me/credits
 * Returns current credit balance, daily usage, and limits.
 */
export const GET: RequestHandler = async ({ locals }) => {
	const prisma = await getPrismaClient();

	const user = await prisma.user.findUnique({
		where: { id: locals.user.userId },
		select: { credits: true, role: true }
	});

	if (!user) {
		return json({ error: 'User not found' }, { status: 404 });
	}

	// Get daily usage
	const dailyUsed = await creditService.getDailyCreditUsage(locals.user.userId);
	const dailyLimit = creditService.getDailyLimit(user.role);

	return json({
		balance: user.credits,
		dailyUsed,
		dailyLimit,
		role: user.role
	});
};
