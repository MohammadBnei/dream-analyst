import { env } from '$env/dynamic/private';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { getPrismaClient } from '$lib/server/db'; // Import Prisma client
import { getCreditService } from '$lib/server/creditService'; // Import credit service
import type { DreamPromptType } from '$lib/prompts/dreamAnalyst';
import { promptService } from '$lib/prompts/promptService';
import { getLLMService } from '$lib/server/services/llmService'; // Import the new LLMService

const OPENROUTER_API_KEY = env.OPENROUTER_API_KEY; // Still needed for error check, but LLMService uses it
const YOUR_SITE_URL = env.ORIGIN; // Still needed for error check, but LLMService uses it

class ServerChatService {
	private prisma: Awaited<ReturnType<typeof getPrismaClient>> | undefined;
	private creditService: ReturnType<typeof getCreditService>;
	private llmService: ReturnType<typeof getLLMService>; // Add LLMService instance

	constructor() {
		// Initialize prisma client here, or ensure it's initialized before use
		getPrismaClient().then((client) => {
			this.prisma = client;
		});
		this.creditService = getCreditService();
		this.llmService = getLLMService(); // Initialize LLMService
	}

	private async getPrisma(): Promise<Awaited<ReturnType<typeof getPrismaClient>>> {
		if (!this.prisma) {
			this.prisma = await getPrismaClient();
		}
		return this.prisma;
	}

	/**
	 * Loads chat history for a specific dream and user from the database.
	 * @param dreamId The ID of the dream.
	 * @param userId The ID of the user.
	 * @returns An array of ChatMessage.
	 */
	async loadChatHistory(dreamId: string, userId: string): Promise<App.ChatMessage[]> {
		const prisma = await this.getPrisma();
		const dbMessages = await prisma.dreamChat.findMany({
			where: {
				dreamId: dreamId,
				userId: userId
			},
			orderBy: {
				createdAt: 'asc'
			}
		});
		return dbMessages.map((msg) => ({
			id: msg.id, // Include id
			role: msg.role as 'user' | 'assistant', // Assuming role is always 'user' or 'assistant'
			content: msg.content,
			promptType: msg.promptType as DreamPromptType
		}));
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
	async saveChatMessage(
		dreamId: string,
		userId: string,
		role: 'user' | 'assistant',
		content: string,
		promptType?: DreamPromptType
	): Promise<App.ChatMessage> {
		const prisma = await this.getPrisma();
		const createdMessage = await prisma.dreamChat.create({
			data: {
				dreamId: dreamId,
				userId: userId,
				role: role,
				content: content,
				promptType: promptType // Save the prompt type
			}
		});
		return {
			id: createdMessage.id,
			role: createdMessage.role as 'user' | 'assistant',
			content: createdMessage.content,
			promptType: createdMessage.promptType as DreamPromptType
		};
	}

	/**
	 * Clears chat history for a specific dream and user from the database.
	 * @param dreamId The ID of the dream.
	 * @param userId The ID of the user.
	 */
	async clearChatHistory(dreamId: string, userId: string): Promise<void> {
		const prisma = await this.getPrisma();
		await prisma.dreamChat.deleteMany({
			where: {
				dreamId: dreamId,
				userId: userId
			}
		});
		console.log(`Chat history for dream ${dreamId}, user ${userId} cleared from DB.`);
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
	async chatWithAI(
		dreamId: string,
		userId: string,
		userMessage: string,
		dreamRawText: string,
		dreamInterpretation: string,
		promptType: DreamPromptType = 'jungian',
		signal?: AbortSignal
	): Promise<ReadableStream<Uint8Array>> {
		// LLMService handles OPENROUTER_API_KEY check internally
		// if (!OPENROUTER_API_KEY) {
		// 	throw new Error('OPENROUTER_API_KEY is not defined');
		// }

		const encoder = new TextEncoder();
		const creditService = getCreditService();

		// Deduct credits for chat message
		const cost = creditService.getCost('CHAT_MESSAGE');
		let userChatMessage: App.ChatMessage; // To store the created user message

		try {
			// Check if user has enough credits before saving message and calling LLM
			const hasCredits = await creditService.checkCredits(userId, cost);
			if (!hasCredits) {
				throw new Error('Insufficient credits for chat message or daily limit exceeded.');
			}
			// Save user message to DB first to get its ID, then deduct credits linked to it
			userChatMessage = await this.saveChatMessage(
				dreamId,
				userId,
				'user',
				userMessage,
				promptType
			);
			await creditService.deductCredits(userId, cost, 'CHAT_MESSAGE', userChatMessage.id);
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
			const history = await this.loadChatHistory(dreamId, userId);

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

			const messages: (SystemMessage | HumanMessage | AIMessage)[] = [
				new SystemMessage(chatSystemPrompt),
				// Add previous chat messages (excluding the current user message, which is added separately)
				...history
					.filter((msg) => msg.id !== userChatMessage.id)
					.map((msg) => {
						if (msg.role === 'user') return new HumanMessage(msg.content);
						if (msg.role === 'assistant') return new AIMessage(msg.content);
						return new SystemMessage(msg.content); // Should not happen with current roles
					}),
				new HumanMessage(userMessage) // Add the current user message
			];

			const stream = await this.llmService.streamChatCompletion(messages, signal); // Use LLMService

			let assistantResponse = '';
			const saveChatMessage = this.saveChatMessage.bind(this);

			const readableStream = new ReadableStream<Uint8Array>({
				async start(controller) {
					try {
						for await (const chunk of stream) {
							if (signal?.aborted) {
								console.debug(`Chat for dream ${dreamId}: LangChain stream aborted by signal.`);
								break;
							}
							if (chunk) { // chunk is already a string from LLMService
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
						console.error(
							`Chat for dream ${dreamId}: Error during LLM stream processing:`,
							error
						);
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
}

let chatServiceInstance: ServerChatService; // Renamed to ServerChatService

export function getChatService(): ServerChatService {
	if (!chatServiceInstance) {
		chatServiceInstance = new ServerChatService();
	}
	return chatServiceInstance;
}
