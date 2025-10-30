import { fail, redirect } from '@sveltejs/kit';
import { comparePassword, generateToken, setAuthTokenCookie } from '$lib/server/auth';
import { getPrismaClient } from '$lib/server/db';

export const actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const identity = data.get('identity') as string; // Can be username or email
		const password = data.get('password') as string;

		if (!identity || !password) {
			return fail(400, {
				identity,
				message: 'Missing identity or password'
			});
		}

		const prisma = await getPrismaClient();


		const existingUser = await prisma.user.findFirst({
			where: {
				OR: [
					{ username: { equals: identity, mode: 'insensitive' } },
					{ email: { equals: identity, mode: 'insensitive' } }
				]
			}
		});

		if (!existingUser) {
			return fail(400, {
				identity,
				message: 'Invalid credentials'
			});
		}

		const passwordMatch = await comparePassword(password, existingUser.passwordHash);

		if (!passwordMatch) {
			return fail(400, {
				identity,
				message: 'Invalid credentials'
			});
		}

		const token = generateToken(existingUser.id, existingUser.username, existingUser.email);
		setAuthTokenCookie(cookies, token);

		throw redirect(302, '/');
	}
};
