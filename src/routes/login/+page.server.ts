import { fail, redirect } from '@sveltejs/kit';
import { comparePassword, generateToken, setAuthTokenCookie } from '$lib/server/auth';
import { prisma } from '$lib/server/db'; // Import prisma client

export const actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const username = data.get('username') as string;
		const password = data.get('password') as string;

		if (!username || !password) {
			return fail(400, {
				username,
				message: 'Missing username or password'
			});
		}

		const existingUser = await prisma.user.findUnique({
			where: { username }
		});

		if (!existingUser) {
			return fail(400, {
				username,
				message: 'Invalid credentials'
			});
		}

		const passwordMatch = await comparePassword(password, existingUser.passwordHash);

		if (!passwordMatch) {
			return fail(400, {
				username,
				message: 'Invalid credentials'
			});
		}

		const token = generateToken(existingUser.id, existingUser.username, existingUser.email || undefined);
		setAuthTokenCookie(cookies, token);

		throw redirect(302, '/');
	}
};
