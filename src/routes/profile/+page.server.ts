import { fail, redirect } from '@sveltejs/kit';
import { getPrismaClient } from '$lib/server/db';
import { getCreditService } from '$lib/server/creditService';
import { generateToken, setAuthTokenCookie } from '$lib/server/auth';
import { z } from 'zod'; // For validation

// Define schemas for validation
const UpdateProfileSchema = z.object({
	username: z
		.string()
		.min(3, 'Username must be at least 3 characters long')
		.max(50, 'Username cannot exceed 50 characters')
		.optional(),
	email: z.email('Invalid email address').optional()
});

export const load = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const prisma = await getPrismaClient();
	const creditService = getCreditService();

	const user = await prisma.user.findUnique({
		where: { id: locals.user.id },
		select: {
			id: true,
			username: true,
			email: true,
			role: true,
			credits: true
		}
	});

	if (!user) {
		throw redirect(302, '/login'); // User not found in DB, redirect to login
	}

	// Ensure credits are up-to-date (e.g., daily grant on page load)
	const updatedCredits = await creditService.grantDailyCredits(user.id);
	user.credits = updatedCredits;

	return {
		user: {
			id: user.id,
			username: user.username,
			email: user.email,
			role: user.role,
			credits: user.credits
		},
		dailyLimit: creditService.getDailyLimit(user.role),
		dailyUsage: await creditService.getDailyCreditUsage(user.id)
	};
};

export const actions = {
	updateProfile: async ({ request, locals, cookies }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const username = data.get('username') as string;
		const email = data.get('email') as string;

		try {
			// Validate input
			const validatedData = UpdateProfileSchema.parse({
				username: username || undefined, // Make optional if empty string
				email: email || undefined
			});

			const prisma = await getPrismaClient();

			const updateData: { username?: string; email?: string } = {};

			if (validatedData.username && validatedData.username !== locals.user.username) {
				const existingUser = await prisma.user.findUnique({
					where: { username: validatedData.username }
				});
				if (existingUser && existingUser.id !== locals.user.id) {
					return fail(400, { message: 'Username already taken.', username, email });
				}
				updateData.username = validatedData.username;
			}

			if (validatedData.email && validatedData.email !== locals.user.email) {
				const existingEmail = await prisma.user.findUnique({
					where: { email: validatedData.email }
				});
				if (existingEmail && existingEmail.id !== locals.user.id) {
					return fail(400, { message: 'Email already registered.', username, email });
				}
				updateData.email = validatedData.email;
			}

			if (Object.keys(updateData).length === 0) {
				return fail(400, { message: 'No changes detected.', username, email });
			}

			const updatedUser = await prisma.user.update({
				where: { id: locals.user.id },
				data: updateData,
				select: { id: true, username: true, email: true, role: true, credits: true }
			});

			// Regenerate JWT with updated user info
			const newToken = generateToken(
				updatedUser.id,
				updatedUser.username,
				updatedUser.email,
				updatedUser.role
			);
			setAuthTokenCookie(cookies, newToken);

			return { success: true, message: 'Profile updated successfully!', user: updatedUser };
		} catch (e: any) {
			if (e instanceof z.ZodError) {
				const errors = (e as z.ZodError).flatten().fieldErrors;
				return fail(400, {
					message: (errors.username?.[0] as string) || (errors.email?.[0] as string) || 'Validation error.',
					username,
					email
				});
			}
			console.error('Error updating profile:', e);
			return fail(500, { message: 'An unexpected error occurred.', username, email });
		}
	}
};
