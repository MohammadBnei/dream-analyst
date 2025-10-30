import { env } from '$env/dynamic/private';
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { getRedisPublisher } from '$lib/server/streamStateStore'; // Re-use Redis client
import { promptService } from '$lib/server/prompts/promptService';
import type { DreamPromptType } from '$lib/server/prompts/dreamAnalyst';

const OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL_NAME = env.OPENROUTER_MODEL_NAME || 'mistralai/mistral-7b-instruct-v0.2';
const YOUR_SITE_URL = env.ORIGIN;

// Define a type for chat messages
export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

// Redis key prefix for chat history
const CHAT_HISTORY_PREFIX = 'chat_history:';
const CHAT_HISTORY_EXPIRATION_SECONDS = 60 * 60 * 24; // 24 hours

class ChatService {
    private redis: ReturnType<typeof getRedisPublisher>;

    constructor() {
        this.redis = getRedisPublisher();
    }

    private getChatKey(dreamId: string, userId: string): string {
        return `${CHAT_HISTORY_PREFIX}${userId}:${dreamId}`;
    }

    /**
     * Loads chat history for a specific dream and user from Redis.
     * @param dreamId The ID of the dream.
     * @param userId The ID of the user.
     * @returns An array of ChatMessage.
     */
    async loadChatHistory(dreamId: string, userId: string): Promise<ChatMessage[]> {
        const key = this.getChatKey(dreamId, userId);
        const rawHistory = await this.redis.get(key);
        if (rawHistory) {
            try {
                return JSON.parse(rawHistory);
            } catch (e) {
                console.error(`Failed to parse chat history for ${key}:`, e);
                return [];
            }
        }
        return [];
    }

    /**
     * Saves chat history for a specific dream and user to Redis.
     * @param dreamId The ID of the dream.
     * @param userId The ID of the user.
     * @param history The array of ChatMessage to save.
     */
    async saveChatHistory(dreamId: string, userId: string, history: ChatMessage[]): Promise<void> {
        const key = this.getChatKey(dreamId, userId);
        await this.redis.setex(key, CHAT_HISTORY_EXPIRATION_SECONDS, JSON.stringify(history));
    }

    /**
     * Clears chat history for a specific dream and user from Redis.
     * @param dreamId The ID of the dream.
     * @param userId The ID of the user.
     */
    async clearChatHistory(dreamId: string, userId: string): Promise<void> {
        const key = this.getChatKey(dreamId, userId);
        await this.redis.del(key);
        console.log(`Chat history for dream ${dreamId}, user ${userId} cleared.`);
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
        if (!OPENROUTER_API_KEY) {
            throw new Error("OPENROUTER_API_KEY is not defined");
        }

        const encoder = new TextEncoder();

        try {
            const chat = new ChatOpenAI(
                {
                    model: OPENROUTER_MODEL_NAME,
                    temperature: 0.7,
                    streaming: true,
                    apiKey: OPENROUTER_API_KEY,
                    configuration: {
                        baseURL: 'https://openrouter.ai/api/v1',
                        defaultHeaders: {
                            ...(YOUR_SITE_URL && { 'HTTP-Referer': YOUR_SITE_URL }),
                        },
                    },
                },
            );

            // Load existing chat history
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
                // Add previous chat messages
                ...history.map(msg => {
                    if (msg.role === 'user') return new HumanMessage(msg.content);
                    if (msg.role === 'assistant') return new AIMessage(msg.content);
                    return new SystemMessage(msg.content); // Should not happen with current roles
                }),
                new HumanMessage(userMessage), // Add the current user message
            ];

            const stream = await chat.stream(messages, { signal: signal });

            let assistantResponse = '';

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
                            controller.enqueue(encoder.encode(JSON.stringify({ final: true, message: 'Chat aborted.' }) + '\n'));
                        } else {
                            // Save updated history
                            const updatedHistory = [
                                ...history,
                                { role: 'user', content: userMessage },
                                { role: 'assistant', content: assistantResponse }
                            ];
                            await ChatService.getInstance().saveChatHistory(dreamId, userId, updatedHistory);
                            controller.enqueue(encoder.encode(JSON.stringify({ final: true }) + '\n'));
                        }
                    } catch (error) {
                        console.error(`Chat for dream ${dreamId}: Error during LangChain stream processing:`, error);
                        controller.enqueue(encoder.encode(JSON.stringify({ final: true, message: `Chat error: ${(error as Error).message}` }) + '\n'));
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
                    controller.enqueue(encoder.encode(JSON.stringify({ final: true, message: `Failed to initiate chat service: ${(error as Error).message}` }) + '\n'));
                    controller.close();
                }
            });
        }
    }
}

let chatServiceInstance: ChatService;

export function getChatService(): ChatService {
    if (!chatServiceInstance) {
        chatServiceInstance = new ChatService();
    }
    return chatServiceInstance;
}
