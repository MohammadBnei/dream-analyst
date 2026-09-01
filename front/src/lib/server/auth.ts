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
// nothing anywhere said the signing key was public. An auth system running
// without a signing key is not degraded, it is bypassed.
//
// Checked at USE, not at import. A module-scope throw also fires during
// `vite build`, which evaluates server modules — so requiring it there broke
// the image build rather than the insecure default. Failing on the first sign
// or verify is just as loud at runtime and does not conflate "cannot build"
// with "is not configured".
function jwtSecret(): string {
	const secret = env.JWT_SECRET;
	if (!secret) {
		throw new Error(
			'JWT_SECRET is not set. Refusing to sign or verify a session token: it would ' +
				'use a predictable key, which means anyone could forge one. Set it in the ' +
				'environment (see .env.example).'
		);
	}
	return secret;
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
