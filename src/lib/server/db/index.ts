import { env } from '$env/dynamic/private';
import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

const prisma = new PrismaClient({
	datasourceUrl: env.DATABASE_URL
}).$extends(withAccelerate());


export default prisma;
