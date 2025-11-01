// src/lib/server/services/chatService.ts
import { env } from '$env/dynamic/private';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { getPrismaClient } from '$lib/server/db';
import { getCreditService } from '$lib/server/creditService';
import type { DreamPromptType } from '$lib/prompts/dreamAnalyst';
import { promptService } from '$lib/prompts/promptService';
import type { ChatMessage } from '$lib/types/chat'; // Use the shared ChatMessage interface

const OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL_NAME = env.OPENROUTER_MODEL_NAME || 'mistralai/mistral-7b-instruct-v0.2';
const YOUR_SITE_URL = env.ORIGIN;

class ServerChatService {
	private prisma: Awaited<ReturnType<typeof getPrismaClient>> | undefined;
	private creditService: ReturnType<typeof getCreditService>;

	constructor() {
		getPrismaClient().then((client) => {
			this.prisma = client;
		});
		this.creditService = getCreditService();
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
	async loadChatHistory(dreamId: string, userId: string): Promise<ChatMessage[]> {
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
			id: msg.id,
			role: msg.role as 'user' | 'assistant',
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
	 * @returns The created ChatMessage, including its ID.
	 */
	async saveChatMessage(
		dreamId: string,
		userId: string,
		role: 'user' | 'assistant',
		content: string,
		promptType?: DreamPromptType
	): Promise<ChatMessage> {
		const prisma = await this.getPrisma();
		const createdMessage = await prisma.dreamChat.create({
			data: {
				dreamId: dreamId,
				userId: userId,
				role: role,
				content: content,
				promptType: promptType
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
	 * Deletes a single chat message from the database.
	 * @param messageId The ID of the message to delete.
	 * @param dreamId The ID of the dream the message belongs to.
	 * @param userId The ID of the user who owns the dream.
	 */
	async deleteChatMessage(messageId: string, dreamId: string, userId: string): Promise<void> {
		const prisma = await this.getPrisma();
		// Verify the message belongs to the dream and the dream belongs to the user
		const message = await prisma.dreamChat.findFirst({
			where: {
				id: messageId,
				dreamId: dreamId,
				dream: {
					userId: userId
				}
			}
		});

		if (!message) {
			throw new Error('Chat message not found or not authorized to delete.');
		}

		await prisma.dreamChat.delete({
			where: {
				id: messageId
			}
		});
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
	 * @param signal An AbortSignal to cancel the LLM request.
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
		if (!OPENROUTER_API_KEY) {
			throw new Error('OPENROUTER_API_KEY is not defined');
		}

		const encoder = new TextEncoder();
		const cost = this.creditService.getCost('CHAT_MESSAGE');
		let userChatMessage: ChatMessage;

		try {
			const hasCredits = await this.creditService.checkCredits(userId, cost);
			if (!hasCredits) {
				throw new Error('Insufficient credits for chat message or daily limit exceeded.');
			}
			userChatMessage = await this.saveChatMessage(
				dreamId,
				userId,
				'user',
				userMessage,
				promptType
			);
			await this.creditService.deductCredits(userId, cost, 'CHAT_MESSAGE', userChatMessage.id);
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
			const chat = new ChatOpenAI({
				model: OPENROUTER_MODEL_NAME,
				temperature: 0.7,
				streaming: true,
				apiKey: OPENROUTER_API_KEY,
				configuration: {
					baseURL: 'https://openrouter.ai/api/v1',
					defaultHeaders: {
						...(YOUR_SITE_URL && { 'HTTP-Referer': YOUR_SITE_URL })
					}
				}
			});

			const history = await this.loadChatHistory(dreamId, userId);

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
				...history
					.filter((msg) => msg.id !== userChatMessage.id) // Exclude the current user message, it's added below
					.map((msg) => {
						if (msg.role === 'user') return new HumanMessage(msg.content);
						if (msg.role === 'assistant') return new AIMessage(msg.content);
						return new SystemMessage(msg.content);
					}),
				new HumanMessage(userMessage)
			];

			const stream = await chat.stream(messages, { signal: signal });

			let assistantResponse = '';
			const saveAssistantMessage = this.saveChatMessage.bind(this); // Bind for use in stream

			const readableStream = new ReadableStream<Uint8Array>({
				async start(controller) {
					try {
						for await (const chunk of stream) {
							if (signal?.aborted) {
								console.debug(`Chat for dream ${dreamId}: LangChain stream aborted by signal.`);
								break;
							}
							const content = chunk.content;
							if (content) {
								assistantResponse += content;
								controller.enqueue(encoder.encode(JSON.stringify({ content: content }) + '\n'));
							}
						}

						if (signal?.aborted) {
							controller.enqueue(
								encoder.encode(JSON.stringify({ final: true, message: 'Chat aborted.' }) + '\n')
							);
						} else {
							await saveAssistantMessage(
								dreamId,
								userId,
								'assistant',
								assistantResponse,
								promptType
							);
							controller.enqueue(encoder.encode(JSON.stringify({ final: true }) + '\n'));
						}
					} catch (error) {
						console.error(
							`Chat for dream ${dreamId}: Error during LangChain stream processing:`,
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
			console.error('Error initiating LangChain chat:', error);
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

let serverChatServiceInstance: ServerChatService;

export function getServerChatService(): ServerChatService {
	if (!serverChatServiceInstance) {
		serverChatServiceInstance = new ServerChatService();
	}
	return serverChatServiceInstance;
}
