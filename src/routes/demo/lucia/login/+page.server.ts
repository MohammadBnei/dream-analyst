import { hash, verify } from '@node-rs/argon2';
import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import * as auth from '$lib/server/auth'; // Now refers to the JWT auth
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	// Check for JWT in cookies
	const token = event.cookies.get(auth.authTokenCookieName);
	if (token) {
		const decoded = auth.verifyToken(token);
		if (decoded) {
			// If token is valid, user is logged in
			return redirect(302, '/demo/lucia');
		}
	}
	return {};
};

export const actions: Actions = {
	login: async (event) => {
		const formData = await event.request.formData();
		const username = formData.get('username');
		const password = formData.get('password');

		if (!validateUsername(username)) {
			return fail(400, {
				message: 'Invalid username (min 3, max 31 characters, alphanumeric only)'
			});
		}
		if (!validatePassword(password)) {
			return fail(400, { message: 'Invalid password (min 6, max 255 characters)' });
		}

		const results = await db.select().from(table.user).where(eq(table.user.username, username));

		const existingUser = results.at(0);
		if (!existingUser) {
			return fail(400, { message: 'Incorrect username or password' });
		}

		// Use argon2 for password verification
		const validPassword = await verify(existingUser.passwordHash, password, {
			memoryCost: 19456,
			timeCost: 2,
			outputLen: 32,
			parallelism: 1
		});
		if (!validPassword) {
			return fail(400, { message: 'Incorrect username or password' });
		}

		// Generate JWT and set as cookie
		const token = auth.generateToken(existingUser.id);
		auth.setAuthTokenCookie(event, token);

		return redirect(302, '/demo/lucia');
	},
	register: async (event) => {
		const formData = await event.request.formData();
		const username = formData.get('username');
		const password = formData.get('password');

		if (!validateUsername(username)) {
			return fail(400, { message: 'Invalid username' });
		}
		if (!validatePassword(password)) {
			return fail(400, { message: 'Invalid password' });
		}

		// Use argon2 for password hashing
		const passwordHash = await hash(password, {
			memoryCost: 19456,
			timeCost: 2,
			outputLen: 32,
			parallelism: 1
		});

		try {
			// Insert user into the database
			const [newUser] = await db.insert(table.user).values({ username, passwordHash }).returning({ id: table.user.id });

			if (!newUser?.id) {
				throw new Error('Failed to create user or retrieve user ID');
			}

			// Generate JWT and set as cookie
			const token = auth.generateToken(newUser.id);
			auth.setAuthTokenCookie(event, token);

		} catch (e: any) { // Catch the error to provide more specific feedback
			console.error("Registration error:", e);
			if (e.message && e.message.includes('duplicate key value violates unique constraint "user_username_unique"')) {
				return fail(409, { message: 'Username already taken' });
			}
			return fail(500, { message: 'An error has occurred during registration' });
		}
		return redirect(302, '/demo/lucia');
	}
};

function validateUsername(username: unknown): username is string {
	return (
		typeof username === 'string' &&
		username.length >= 3 &&
		username.length <= 31 &&
		/^[a-z0-9_-]+$/.test(username)
	);
}

function validatePassword(password: unknown): password is string {
	return typeof password === 'string' && password.length >= 6 && password.length <= 255;
}
