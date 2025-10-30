import { error } from '@sveltejs/kit';
import { getPrismaClient } from '$lib/server/db';
import { getChatService } from '$lib/server/chatService';
import type { DreamPromptType } from '$lib/prompts/dreamAnalyst';

const encoder = new TextEncoder();

function getCurrentUser(locals: App.Locals) {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }
    return locals.user;
}

export async function POST({ params, locals, request }) {
    const dreamId = params.id;
    const sessionUser = getCurrentUser(locals);
    const prisma = await getPrismaClient();
    const chatService = getChatService();

    if (!dreamId) {
        throw error(400, 'Dream ID is required.');
    }

    const dream = await prisma.dream.findUnique({
        where: { id: dreamId }
    });

    if (!dream || dream.userId !== sessionUser.id) {
        throw error(403, 'Forbidden: Dream does not belong to user or does not exist.');
    }

    if (!dream.interpretation) {
        throw error(400, 'Dream must have an initial interpretation before starting a chat.');
    }

    const { message: userMessage } = await request.json();
    if (!userMessage || typeof userMessage !== 'string') {
        throw error(442, 'User message is required and must be a string.');
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
                'Connection': 'keep-alive'
            }
        });

    } catch (e) {
        console.error(`Error in chat-interpretation endpoint for dream ${dreamId}:`, e);
        throw error(500, `Failed to initiate chat: ${(e as Error).message}`);
    }
}

// GET endpoint to retrieve chat history
export async function GET({ params, locals }) {
    const dreamId = params.id;
    const sessionUser = getCurrentUser(locals);
    const chatService = getChatService();

    if (!dreamId) {
        throw error(400, 'Dream ID is required.');
    }

    try {
        const history = await chatService.loadChatHistory(dreamId, sessionUser.id);
        return new Response(JSON.stringify(history), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (e) {
        console.error(`Error loading chat history for dream ${dreamId}:`, e);
        throw error(500, `Failed to load chat history: ${(e as Error).message}`);
    }
}

// DELETE endpoint to clear chat history
export async function DELETE({ params, locals }) {
    const dreamId = params.id;
    const sessionUser = getCurrentUser(locals);
    const chatService = getChatService();

    if (!dreamId) {
        throw error(400, 'Dream ID is required.');
    }

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
        throw error(500, `Failed to clear chat history: ${(e as Error).message}`);
    }
}
