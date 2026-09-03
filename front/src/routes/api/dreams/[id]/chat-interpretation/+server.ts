import { error } from '@sveltejs/kit';
import type { DreamPromptType } from '$lib/promptTypes';
import { getServerChatService } from '$lib/server/chatService';
import { InsufficientCreditsError } from '$lib/server/creditService';
import { requireUser, requireOwnedDream } from '$lib/server/guards';

export async function POST({ params, locals, request }) {
	const dreamId = params.id;
	if (!dreamId) error(400, 'Dream ID is required.');

	const sessionUser = requireUser(locals);
	const dream = await requireOwnedDream(locals, dreamId);
	const chatService = getServerChatService();

	if (!dream.interpretation) {
		error(400, 'Dream must have an initial interpretation before starting a chat.');
	}

	const { message: userMessage } = await request.json();
	if (!userMessage || typeof userMessage !== 'string') {
		// Was 442, which is not an assigned HTTP status code.
		error(422, 'User message is required and must be a string.');
	}

	const dreamPromptType: DreamPromptType = (dream.promptType as DreamPromptType) || 'jungian';

	try {
		const aiStream = await chatService.chatWithAI(
			dreamId,
			sessionUser.id,
			userMessage,
			dream.rawText,
			dream.interpretation,
			dreamPromptType,
			request.signal // Pass the abort signal from the client request
		);

		return new Response(aiStream, {
			headers: {
				'Content-Type': 'application/x-ndjson',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive'
			}
		});
	} catch (e) {
		console.error(`Error in chat-interpretation endpoint for dream ${dreamId}:`, e);
		// Typed, not string-matched: the previous check broke on any rewording.
		if (e instanceof InsufficientCreditsError) error(402, e.message);
		error(500, 'Failed to initiate chat.');
	}
}

// GET endpoint to retrieve chat history
export async function GET({ params, locals }) {
	const dreamId = params.id;
	if (!dreamId) error(400, 'Dream ID is required.');

	// Previously unchecked: chatService scopes by dreamId + userId so no cross-user
	// read was possible, but asking for someone else's dream returned an empty 200
	// instead of 404.
	const sessionUser = requireUser(locals);
	await requireOwnedDream(locals, dreamId);
	const chatService = getServerChatService();

	try {
		const history = await chatService.loadChatHistory(dreamId, sessionUser.id);
		return new Response(JSON.stringify(history), {
			headers: {
				'Content-Type': 'application/json'
			}
		});
	} catch (e) {
		console.error(`Error loading chat history for dream ${dreamId}:`, e);
		error(500, 'Failed to load chat history.');
	}
}

// DELETE endpoint to clear chat history
export async function DELETE({ params, locals }) {
	const dreamId = params.id;
	if (!dreamId) error(400, 'Dream ID is required.');

	const sessionUser = requireUser(locals);
	await requireOwnedDream(locals, dreamId);
	const chatService = getServerChatService();

	try {
		await chatService.clearChatHistory(dreamId, sessionUser.id);
		return new Response(JSON.stringify({ message: 'Chat history cleared.' }), {
			status: 200,
			headers: {
				'Content-Type': 'application/json'
			}
		});
	} catch (e) {
		console.error(`Error clearing chat history for dream ${dreamId}:`, e);
		error(500, 'Failed to clear chat history.');
	}
}
