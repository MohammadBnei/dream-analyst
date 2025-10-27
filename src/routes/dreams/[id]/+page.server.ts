import { error, redirect } from '@sveltejs/kit';
import prisma from '$lib/server/db';

export async function load({ params, locals }) {
    const sessionUser = locals.user;
    if (!sessionUser) {
        throw redirect(302, '/login');
    }

    const dreamId = params.id;

    const dream = await prisma.dream.findUnique({
        where: {
            id: dreamId,
            userId: sessionUser.id // Ensure the dream belongs to the logged-in user
        }
    });

    if (!dream) {
        throw error(404, 'Dream not found.');
    }

    // Ensure tags are parsed correctly if stored as JSON string
    const dreamWithParsedTags = {
        ...dream,
        tags: dream.tags ? (dream.tags as string[]) : null // Assuming tags are stored as JSON array of strings
    };

    return {
        dream: dreamWithParsedTags
    };
}
