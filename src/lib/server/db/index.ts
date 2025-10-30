import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

let prisma: PrismaClient;
export const getPrismaClient = async () => {
	if (!prisma) {
		prisma = new PrismaClient().$extends(withAccelerate());
	}
	return prisma;
};
