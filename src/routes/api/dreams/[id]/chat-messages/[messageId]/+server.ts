import { error, json } from '@sveltejs/kit';
import { getServerChatService } from '$lib/server/services/chatService'; // Import the new service

export async function DELETE({ params, locals }) {
	const dreamId = params.id;
	const messageId = params.messageId;
	const sessionUser = locals.user;
	const chatService = getServerChatService(); // Get the new chat service instance

	if (!sessionUser) {
		throw error(401, 'Unauthorized');
	}

	if (!dreamId || !messageId) {
		throw error(400, 'Dream ID and Message ID are required.');
	}

	try {
		await chatService.deleteChatMessage(messageId, dreamId, sessionUser.id);
		return json({ message: 'Chat message deleted successfully' }, { status: 200 });
	} catch (e) {
		console.error(`Error deleting chat message ${messageId} for dream ${dreamId}:`, e);
		// Check for specific error message from service to return 404
		if ((e as Error).message.includes('not found or not authorized')) {
			throw error(404, (e as Error).message);
		}
		throw error(500, 'Failed to delete chat message.');
	}
}
