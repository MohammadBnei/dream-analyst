import { error, json } from '@sveltejs/kit';
import { getPrismaClient } from '$lib/server/prisma';
import { getCurrentUser } from '$lib/remote/dream.remote'; // Assuming this is the correct path for getCurrentUser

export async function DELETE({ params, locals }) {
    const dreamId = params.id;
    const messageId = params.messageId;
    const sessionUser = await getCurrentUser(locals); // Use await as getCurrentUser is async
    const prisma = await getPrismaClient();

    if (!sessionUser) {
        throw error(401, 'Unauthorized');
    }

    if (!dreamId || !messageId) {
        throw error(400, 'Dream ID and Message ID are required.');
    }

    try {
        // Verify the message belongs to the dream and the dream belongs to the user
        const message = await prisma.chatMessage.findFirst({
            where: {
                id: messageId,
                dreamId: dreamId,
                dream: {
                    userId: sessionUser.id // Use sessionUser.id as per App.Locals.user
                }
            }
        });

        if (!message) {
            throw error(404, 'Chat message not found or not authorized to delete.');
        }

        await prisma.chatMessage.delete({
            where: {
                id: messageId
            }
        });

        return json({ message: 'Chat message deleted successfully' }, { status: 200 });
    } catch (e) {
        console.error(`Error deleting chat message ${messageId} for dream ${dreamId}:`, e);
        throw error(500, 'Failed to delete chat message.');
    }
}
