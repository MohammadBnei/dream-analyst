import { fail, redirect } from '@sveltejs/kit';
import { getPrismaClient } from '$lib/server/db';
import { getCreditService } from '$lib/server/creditService';
import { UserRole } from '@prisma/client';
import { z } from 'zod';

// Zod schema for updating user role
const UpdateUserRoleSchema = z.object({
	userId: z.uuid('Invalid user ID.'),
	role: z.string()
});

// Zod schema for updating user credits
const UpdateUserCreditsSchema = z.object({
	userId: z.uuid('Invalid user ID.'),
	amount: z.number().int('Amount must be an integer.').min(1, 'Amount must be at least 1.'),
	action: z.enum(['grant', 'deduct'], {
		errorMap: () => ({ message: 'Invalid credit action.' })
	})
});

export const load = async ({ locals }) => {
	// Access control: Only ADMIN users can access this page
	if (!locals.user || locals.user.role !== UserRole.ADMIN) {
		throw redirect(302, '/'); // Redirect non-admins to home
	}

	const prisma = await getPrismaClient();
	const creditService = getCreditService();

	const users = await prisma.user.findMany({
		select: {
			id: true,
			username: true,
			email: true,
			role: true,
			credits: true
		},
		orderBy: {
			username: 'asc'
		}
	});

	// For each user, ensure daily credits are granted and get daily usage
	const usersWithDailyInfo = await Promise.all(
		users.map(async (user) => {
			const updatedCredits = await creditService.grantDailyCredits(user.id); // Ensure daily credits are granted
			const dailyUsage = await creditService.getDailyCreditUsage(user.id);
			return {
				...user,
				credits: updatedCredits, // Use the updated credits
				dailyUsage: dailyUsage,
				dailyLimit: creditService.getDailyLimit(user.role)
			};
		})
	);

	return {
		users: usersWithDailyInfo,
		userRoles: Object.values(UserRole) // Pass available roles to the frontend
	};
};

export const actions = {
	updateUserRole: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== UserRole.ADMIN) {
			throw fail(403, { message: 'Forbidden: Not an admin.' });
		}

		const formData = await request.formData();
		const userId = formData.get('userId') as string;
		const role = formData.get('role') as UserRole;

		try {
			const validatedData = UpdateUserRoleSchema.parse({ userId, role });
			const prisma = await getPrismaClient();

			await prisma.user.update({
				where: { id: validatedData.userId },
				data: { role: validatedData.role }
			});

			return {
				success: true,
				userId: validatedData.userId,
				message: `User ${validatedData.userId} role updated to ${validatedData.role}.`
			};
		} catch (e) {
			if (e instanceof z.ZodError) {
				return fail(400, { message: e.message });
			}
			console.error('Error updating user role:', e);
			return fail(500, { message: 'Failed to update user role.' });
		}
	},

	updateUserCredits: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== UserRole.ADMIN) {
			throw fail(403, { message: 'Forbidden: Not an admin.' });
		}

		const formData = await request.formData();
		const userId = formData.get('userId') as string;
		const amount = parseInt(formData.get('amount') as string);
		const action = formData.get('action') as 'grant' | 'deduct';

		try {
			const validatedData = UpdateUserCreditsSchema.parse({ userId, amount, action });
			const creditService = getCreditService();

			let newCredits: number;
			if (validatedData.action === 'grant') {
				newCredits = await creditService.adminGrantCredits(
					locals.user.id,
					validatedData.userId,
					validatedData.amount
				);
			} else {
				// 'deduct'
				newCredits = await creditService.adminDeductCredits(
					locals.user.id,
					validatedData.userId,
					validatedData.amount
				);
			}

			return {
				success: true,
				message: `User ${validatedData.userId} credits ${validatedData.action}ed by ${validatedData.amount}. New balance: ${newCredits}.`,
				userId: validatedData.userId
			};
		} catch (e) {
			if (e instanceof z.ZodError) {
				return fail(400, { message: e.message });
			}
			console.error('Error updating user credits:', e);
			return fail(500, { message: `Failed to ${action} credits: ${(e as Error).message}` });
		}
	}
};
