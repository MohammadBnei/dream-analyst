import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { hashPassword, comparePassword } from '$lib/server/auth';
import { eq } from 'drizzle-orm';

export async function createUser(username: string, email: string | undefined, passwordPlain: string): Promise<string> {
  const passwordHash = await hashPassword(passwordPlain);
  const [newUser] = await db.insert(user).values({ username, email, passwordHash }).returning({ id: user.id });
  return newUser.id;
}

export async function getUserByUsername(username: string) {
  return db.query.user.findFirst({
    where: eq(user.username, username),
  });
}

export async function getUserById(id: string) {
  return db.query.user.findFirst({
    where: eq(user.id, id),
  });
}

export async function validateUserPassword(username: string, passwordPlain: string) {
  const existingUser = await getUserByUsername(username);

  if (!existingUser) {
    return null;
  }

  const passwordMatch = await comparePassword(passwordPlain, existingUser.passwordHash);

  if (!passwordMatch) {
    return null;
  }

  return existingUser;
}
