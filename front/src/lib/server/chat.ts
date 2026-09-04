import { error } from '@sveltejs/kit';
import { getPrismaClient } from '$lib/server/db';
import type { PrismaClient } from '@prisma/client';
import { checkCredits, costOf, deductCredits, InsufficientCreditsError } from '$lib/server/credits';
import type { DreamPromptType } from '$lib/promptTypes';
import { promptService } from '$lib/server/prompts/promptService';
import { getLLMService, type ChatMessage } from './llmService';

/**
 * Per-dream chat.
 *
 * Like credits.ts and analysis.ts, every function takes the Prisma client as an
 * optional last argument: call sites pass nothing, tests pass their own.
 *
 * Plain functions rather than a singleton class: the class held only a Prisma
 * client it constructed itself, which made the module impossible to point at a
 * test database.
 */
/**
 * Loads chat history for a specific dream and user from the database.
 * @param dreamId The ID of the dream.
 * @param userId The ID of the user.
 * @returns An array of ChatMessage.
 */
export async function loadChatHistory(
	dreamId: string,
	userId: string,
	prisma: PrismaClient = getPrismaClient()
): Promise<App.ChatMessage[]> {
	return prisma.dreamChat.findMany({
		where: {
			dreamId: dreamId,
			userId: userId
		},
		orderBy: {
			createdAt: 'asc'
		}
	});
}

/**
 * Saves a single chat message to the database.
 * @param dreamId The ID of the dream.
 * @param userId The ID of the user.
 * @param role The role of the message sender ('user' or 'assistant').
 * @param content The content of the message.
 * @param promptType The prompt type used for this message (optional, primarily for AI messages).
 * @returns The created DreamChat message, including its ID.
 */
export async function saveChatMessage(
	dreamId: string,
	userId: string,
	role: 'user' | 'assistant',
	content: string,
	promptType?: DreamPromptType,
	prisma: PrismaClient = getPrismaClient()
): Promise<App.ChatMessage> {
	return prisma.dreamChat.create({
		data: {
			dreamId: dreamId,
			userId: userId,
			role: role,
			content: content,
			promptType: promptType // Save the prompt type
		}
	});
}

/**
 * Clears chat history for a specific dream and user from the database.
 * @param dreamId The ID of the dream.
 * @param userId The ID of the user.
 */
export async function clearChatHistory(
	dreamId: string,
	userId: string,
	prisma: PrismaClient = getPrismaClient()
): Promise<void> {
	await prisma.dreamChat.deleteMany({
		where: {
			dreamId: dreamId,
			userId: userId
		}
	});
	console.debug(`Chat history for dream ${dreamId}, user ${userId} cleared from DB.`);
}

/**
 * Deletes a specific chat message from the database.
 * @param messageId The ID of the message to delete.
 * @param dreamId The ID of the dream the message belongs to.
 * @param userId The ID of the user who owns the message/dream.
 */
export async function deleteChatMessage(
	messageId: string,
	dreamId: string,
	userId: string,
	prisma: PrismaClient = getPrismaClient()
): Promise<void> {
	const message = await prisma.dreamChat.findUnique({
		where: { id: messageId }
	});

	// 404 for "missing" and "not yours" alike, so this cannot be used to probe
	// which message ids exist. Raised as an HttpError rather than a generic Error:
	// the caller used to detect this by string-matching the message, which breaks
	// the moment anyone rewords it.
	if (!message || message.dreamId !== dreamId || message.userId !== userId) {
		error(404, 'Chat message not found.');
	}

	await prisma.dreamChat.delete({
		where: { id: messageId }
	});
	console.debug(`Chat message ${messageId} for dream ${dreamId} deleted from DB.`);
}

/**
 * Initiates a chat interaction with the LLM for dream interpretation.
 * @param dreamId The ID of the dream.
 * @param userId The ID of the user.
 * @param userMessage The user's current message.
 * @param dreamRawText The raw text of the dream.
 * @param dreamInterpretation The initial interpretation of the dream.
 * @param promptType The type of interpretation prompt to use.
 * @returns A ReadableStream of chat responses.
 */
export async function chatWithAI(
	dreamId: string,
	userId: string,
	userMessage: string,
	dreamRawText: string,
	dreamInterpretation: string,
	promptType: DreamPromptType = 'jungian',
	signal?: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
	const encoder = new TextEncoder();

	// Deduct credits for chat message
	const cost = costOf('CHAT_MESSAGE');
	let userChatMessage: App.ChatMessage; // To store the created user message

	try {
		// Check if user has enough credits before saving message and calling LLM
		const hasCredits = await checkCredits(userId, cost);
		if (!hasCredits) {
			throw new InsufficientCreditsError(
				'Insufficient credits for chat message or daily limit exceeded.'
			);
		}
		// Save user message to DB first to get its ID, then deduct credits linked to it
		userChatMessage = await saveChatMessage(dreamId, userId, 'user', userMessage, promptType);
		await deductCredits(userId, cost, 'CHAT_MESSAGE', userChatMessage.id);
	} catch (creditError) {
		console.error(
			`Credit deduction failed for chat message for dream ${dreamId}, user ${userId}:`,
			creditError
		);
		return new ReadableStream({
			start(controller) {
				controller.enqueue(
					encoder.encode(
						JSON.stringify({
							final: true,
							message: `Credit error: ${(creditError as Error).message}`
						}) + '\n'
					)
				);
				controller.close();
			}
		});
	}

	try {
		// Load existing chat history from DB (excluding the just-saved user message, as it's already handled)
		const history = await loadChatHistory(dreamId, userId);

		// Construct the initial system prompt based on the chosen interpretation type
		const baseSystemPrompt = promptService.getSystemPrompt(promptType);
		const chatSystemPrompt = `
                ${baseSystemPrompt}

                You are now in a conversational mode. The user wants to discuss their dream and its interpretation.
                The dream text is: "${dreamRawText}"
                The initial interpretation you provided was: "${dreamInterpretation}"

                Respond conversationally, building upon the initial interpretation and addressing the user's questions.
                Maintain the persona of a ${promptType} dream interpreter.
                Keep responses concise and focused on the dream.
            `;

		const messages: ChatMessage[] = [
			{ role: 'system', content: chatSystemPrompt },
			// Add previous chat messages (excluding the current user message, which is added separately)
			...history
				.filter((msg) => msg.id !== userChatMessage.id)
				.map((msg) => {
					if (msg.role === 'user') return { role: 'user' as const, content: msg.content };
					if (msg.role === 'assistant') return { role: 'assistant' as const, content: msg.content };
					return { role: 'system' as const, content: msg.content };
				}),
			{ role: 'user' as const, content: userMessage }
		];

		const stream = await getLLMService().streamChatCompletion(messages, signal); // Use LLMService

		let assistantResponse = '';

		const readableStream = new ReadableStream<Uint8Array>({
			async start(controller) {
				try {
					for await (const chunk of stream) {
						if (signal?.aborted) {
							console.debug(`Chat for dream ${dreamId}: LangChain stream aborted by signal.`);
							break;
						}
						if (chunk) {
							// chunk is already a string from LLMService
							assistantResponse += chunk;
							controller.enqueue(encoder.encode(JSON.stringify({ content: chunk }) + '\n'));
						}
					}

					if (signal?.aborted) {
						controller.enqueue(
							encoder.encode(JSON.stringify({ final: true, message: 'Chat aborted.' }) + '\n')
						);
					} else {
						// Save AI response to DB
						await saveChatMessage(dreamId, userId, 'assistant', assistantResponse, promptType);
						controller.enqueue(encoder.encode(JSON.stringify({ final: true }) + '\n'));
					}
				} catch (error) {
					console.error(`Chat for dream ${dreamId}: Error during LLM stream processing:`, error);
					controller.enqueue(
						encoder.encode(
							JSON.stringify({
								final: true,
								message: `Chat error: ${(error as Error).message}`
							}) + '\n'
						)
					);
				} finally {
					controller.close();
				}
			},
			cancel(reason) {
				console.debug(`Chat for dream ${dreamId}: Client stream cancelled. Reason:`, reason);
			}
		});

		return readableStream;
	} catch (error) {
		console.error('Error initiating chat service:', error);
		return new ReadableStream({
			start(controller) {
				controller.enqueue(
					encoder.encode(
						JSON.stringify({
							final: true,
							message: `Failed to initiate chat service: ${(error as Error).message}`
						}) + '\n'
					)
				);
				controller.close();
			}
		});
	}
}
