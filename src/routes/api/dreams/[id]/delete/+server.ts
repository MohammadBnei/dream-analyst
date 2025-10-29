import { json, error } from '@sveltejs/kit';
import { getPrismaClient } from '$lib/server/db';

export async function DELETE({ params, locals }) {
    const dreamId = params.id;
    const sessionUser = locals.user;

    if (!sessionUser) {
        throw error(401, 'Unauthorized');
    }

    if (!dreamId) {
        throw error(400, 'Dream ID is required.');
    }

    const prisma = await getPrismaClient();

    try {
        // Verify that the dream belongs to the authenticated user
        const dream = await prisma.dream.findUnique({
            where: {
                id: dreamId,
                userId: sessionUser.id
            }
        });

        if (!dream) {
            throw error(404, 'Dream not found or you do not have permission to delete it.');
        }

        await prisma.dream.delete({
            where: {
                id: dreamId
            }
        });

        return json({ message: 'Dream deleted successfully.' }, { status: 200 });
    } catch (e) {
        console.error('Error deleting dream:', e);
        if (e instanceof Error && e.message.includes('not found')) {
            throw error(404, e.message);
        }
        throw error(500, 'Failed to delete dream.');
    }
}
