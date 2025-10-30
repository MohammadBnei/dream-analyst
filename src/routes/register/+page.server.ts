import { fail, redirect } from '@sveltejs/kit';
import { hashPassword, generateToken, setAuthTokenCookie } from '$lib/server/auth';
import { getPrismaClient } from '$lib/server/db';

export const actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const username = data.get('username') as string;
		const email = data.get('email') as string;
		const password = data.get('password') as string;
		const passwordConfirm = data.get('passwordConfirm') as string;

		if (!username || !email || !password || !passwordConfirm) {
			return fail(400, {
				username,
				email,
				message: 'Missing username, password, or password confirmation'
			});
		}

		if (password !== passwordConfirm) {
			return fail(400, {
				username,
				email,
				message: 'Passwords do not match'
			});
		}

		if (password.length < 6) {
			return fail(400, {
				username,
				email,
				message: 'Password must be at least 6 characters long'
			});
		}

		const prisma = await getPrismaClient();


		const existingUser = await prisma.user.findUnique({
			where: { username }
		});

		if (existingUser) {
			return fail(400, {
				username,
				email,
				message: 'Username already taken'
			});
		}

		if (email) {
			const existingEmail = await prisma.user.findUnique({
				where: { email }
			});
			if (existingEmail) {
				return fail(400, {
					username,
					email,
					message: 'Email already registered'
				});
			}
		}

		const passwordHash = await hashPassword(password);

		const newUser = await prisma.user.create({
			data: {
				username,
				email,
				passwordHash
			}
		});

		const token = generateToken(newUser.id, newUser.username, newUser.email);
		setAuthTokenCookie(cookies, token);

		throw redirect(302, '/');
	}
};
