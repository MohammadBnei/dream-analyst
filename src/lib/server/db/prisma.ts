import { PrismaClient } from '@prisma/client';
import { env } from '$env/dynamic/private'; // Use dynamic private env for DATABASE_URL

// This is a singleton pattern to ensure only one PrismaClient instance is created.
// This is important in development to prevent multiple instances from being created
// during hot module reloading, which can lead to too many database connections.
const prisma = globalThis.prisma || new PrismaClient({
    datasourceUrl: env.DATABASE_URL, // Use env.DATABASE_URL here
});

if (process.env.NODE_ENV === 'development') {
    globalThis.prisma = prisma;
}

export { prisma };
