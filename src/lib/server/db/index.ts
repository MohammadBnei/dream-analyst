import { DATABASE_URL } from '$env/dynamic/private';
import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

const prisma = new PrismaClient({
	datasourceUrl: DATABASE_URL
}).$extends(withAccelerate());

export default prisma;
