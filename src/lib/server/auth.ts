import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { env } from '$env/dynamic/private';
import type { Cookies } from '@sveltejs/kit';

const JWT_SECRET = env.JWT_SECRET || 'your_jwt_secret_here'; // Use a strong secret from environment variables
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
  email?: string;
}

export const generateToken = (userId: string, username: string, email?: string): string => {
  const payload: TokenPayload = { userId, username, email };
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

export function setAuthTokenCookie(cookies: Cookies, token: string, maxAge: number = 60 * 60 * 24 * 30) { // 30 days
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
		path: '/'
	});
}
