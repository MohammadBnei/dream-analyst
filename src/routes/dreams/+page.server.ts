import { redirect } from '@sveltejs/kit';
import { getPrismaClient } from '$lib/server/db';
export async function load({ locals }) {
    const sessionUser = locals.user;
    if (!sessionUser) {
        throw redirect(302, '/login');
    }

    const prisma = await getPrismaClient();

    const dreams = await prisma.dream.findMany({
        where: {
            userId: sessionUser.id
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    // Ensure tags are parsed correctly if stored as JSON string
    const dreamsWithParsedTags = dreams.map(dream => ({
        ...dream,
        tags: dream.tags ? (dream.tags as string[]) : null // Assuming tags are stored as JSON array of strings
    }));

    return {
        dreams: dreamsWithParsedTags
    };
}
