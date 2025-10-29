import { env } from '$env/dynamic/private';
import { PrismaClient } from '$lib/server/prisma'; // Updated import path
import { withAccelerate } from '@prisma/extension-accelerate';

const prisma = new PrismaClient({
	datasourceUrl: env.DATABASE_URL
}).$extends(withAccelerate());


export default prisma;
