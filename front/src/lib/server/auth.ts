import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { env } from '$env/dynamic/private';
import type { Cookies } from '@sveltejs/kit';
import type { UserRole } from '@prisma/client'; // Import UserRole enum
import { config } from '$lib/server/config/env';

export const hashPassword = async (password: string): Promise<string> => {
	return bcrypt.hash(password, config.auth.saltRounds);
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
	return jwt.sign(payload, config.auth.jwtSecret, { expiresIn: config.auth.jwtExpiry });
};

export const verifyToken = (token: string): TokenPayload | null => {
	try {
		const decoded = jwt.verify(token, config.auth.jwtSecret) as TokenPayload;
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
