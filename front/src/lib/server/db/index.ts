import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg'
import { env } from '$env/dynamic/private';

let prisma: PrismaClient;
export const getPrismaClient = async () => {
	if (!prisma) {
		const connectionString = `${env.DATABASE_URL}`

		const adapter = new PrismaPg({ connectionString })

		prisma = new PrismaClient({
			adapter
		});
	}
	return prisma;
};
