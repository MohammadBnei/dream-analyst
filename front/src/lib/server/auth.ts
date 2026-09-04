import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { serverEnv } from '$lib/server/env';
import type { Cookies } from '@sveltejs/kit';
import type { UserRole } from '@prisma/client'; // Import UserRole enum

// Read through serverEnv(), which rejects an empty JWT_SECRET along with every
// other required variable, in one error naming all of them. The rationale for
// having no fallback - and for validating at use rather than at import - now
// lives beside the declaration in env.ts.
//
// Still resolved at USE, not at module scope: serverEnv() is lazy, so `vite
// build` (which evaluates server modules) does not need the environment.
const jwtSecret = (): string => serverEnv().JWT_SECRET;

const JWT_EXPIRES_IN = '30d'; // Token expiration time

export const hashPassword = async (password: string): Promise<string> => {
	const saltRounds = 10;
	return bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
	return bcrypt.compare(password, hash);
};

interface TokenPayload {
	userId: string;
	username: string;
	email: string;
	role: UserRole; // Added role to token payload
}

export const generateToken = (
	userId: string,
	username: string,
	email: string,
	role: UserRole
): string => {
	const payload: TokenPayload = { userId, username, email, role };
	return jwt.sign(payload, jwtSecret(), { expiresIn: JWT_EXPIRES_IN });
};

export const verifyToken = (token: string): TokenPayload | null => {
	// Resolved OUTSIDE the try on purpose. Inside, a missing JWT_SECRET would be
	// caught and returned as `null` — indistinguishable from an invalid token,
	// so a misconfigured deployment would look like every user's session simply
	// expiring. It fails closed either way; this makes it say why.
	const secret = jwtSecret();
	try {
		const decoded = jwt.verify(token, secret) as TokenPayload;
		return decoded;
	} catch (error) {
		console.error('JWT verification failed:', error);
		return null;
	}
};

export const authTokenCookieName = 'auth_token';

export function setAuthTokenCookie(
	cookies: Cookies,
	token: string,
	maxAge: number = 60 * 60 * 24 * 30
) {
	// 30 days
	cookies.set(authTokenCookieName, token, {
		httpOnly: true,
		path: '/',
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		maxAge: maxAge
	});
}

export function deleteAuthTokenCookie(cookies: Cookies) {
	cookies.delete(authTokenCookieName, {
		path: '/',
		httpOnly: true, // Ensure httpOnly is set for deletion as well
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax'
	});
}
