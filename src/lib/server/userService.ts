import prisma from '$lib/server/db'; // Import the prisma client
import { hashPassword, comparePassword } from '$lib/server/auth';

export async function createUser(username: string, email: string | undefined, passwordPlain: string): Promise<string> {
  const passwordHash = await hashPassword(passwordPlain);
  const newUser = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash,
    },
    select: {
      id: true,
    },
  });
  return newUser.id;
}

export async function getUserByUsername(username: string) {
  return prisma.user.findUnique({
    where: {
      username,
    },
  });
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: {
      id,
    },
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
