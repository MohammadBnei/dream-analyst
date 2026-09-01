import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { env } from '$env/dynamic/private';
import type { Cookies } from '@sveltejs/kit';
import type { UserRole } from '@prisma/client'; // Import UserRole enum

// No fallback, deliberately. This used to default to the literal
// 'your_jwt_secret_here' when JWT_SECRET was unset — which is exactly what
// happened in production: session cookies were being signed with a placeholder
// published in this repository, so anyone reading it could forge an auth_token
// for any user.
//
// The fallback is what made that invisible: the app booted, logins worked, and
// nothing anywhere said the signing key was public. Failing to start is the
// correct behaviour for a missing signing key — an auth system that runs without
// one is not degraded, it is bypassed.
const JWT_SECRET = env.JWT_SECRET;
if (!JWT_SECRET) {
	throw new Error(
		'JWT_SECRET is not set. Refusing to start: session tokens would be signed ' +
			'with a predictable key, which means anyone can forge them. Set it in the ' +
			'environment (see .env.example).'
	);
}
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
	return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const verifyToken = (token: string): TokenPayload | null => {
	try {
		const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
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
