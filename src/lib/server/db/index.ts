import { PrismaClient } from '../generated/prisma/client.js';
import { DATABASE_URL } from '$env/dynamic/private';
import { withAccelerate } from '@prisma/extension-accelerate';

const prisma = new PrismaClient({
	datasourceUrl: DATABASE_URL
}).$extends(withAccelerate());

export default prisma;
