import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { env } from '$env/dynamic/private';

const JWT_SECRET = env.JWT_SECRET || 'your_jwt_secret_here'; // Use a strong secret from environment variables
const JWT_EXPIRES_IN = '30d'; // Token expiration time

export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const verifyToken = (token: string): { userId: string } | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return decoded;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
};
