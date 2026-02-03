import { env } from '$env/dynamic/private';
import { ChatOpenAI } from '@langchain/openai';
import { BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages'; // Import HumanMessage and SystemMessage

const OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL_NAME = env.OPENROUTER_MODEL_NAME || 'mistralai/mistral-7b-instruct-v0.2';
const OPENROUTER_WEAK_MODEL_NAME = env.OPENROUTER_WEAK_MODEL || 'meta-llama/llama-3.1-70b-instruct'; // Add weak model env var
const YOUR_SITE_URL = env.ORIGIN;

class LLMService {
	private chat: ChatOpenAI;
	private weakChat: ChatOpenAI; // Add a separate instance for the weak model

	constructor() {
		if (!OPENROUTER_API_KEY) {
			throw new Error('OPENROUTER_API_KEY is not defined');
		}

		const commonConfig = {
			temperature: 0.7, // A reasonable default for creative tasks
			apiKey: OPENROUTER_API_KEY,
			configuration: {
				baseURL: 'https://openrouter.ai/api/v1',
				defaultHeaders: {
					...(YOUR_SITE_URL && { 'HTTP-Referer': YOUR_SITE_URL })
				}
			}
		};

		this.chat = new ChatOpenAI({
			model: OPENROUTER_MODEL_NAME,
			streaming: true, // Main chat is streaming
			...commonConfig
		});

		this.weakChat = new ChatOpenAI({
			model: OPENROUTER_WEAK_MODEL_NAME,
			streaming: false, // Weak model is not streaming for this use case
			...commonConfig
		});
	}

	/**
	 * Streams a chat completion from the LLM.
	 * @param messages An array of BaseMessage (SystemMessage, HumanMessage, AIMessage).
	 * @param signal An AbortSignal to cancel the LLM request.
	 * @returns An AsyncIterable<string> of raw LLM content (string chunks).
	 */
	public async streamChatCompletion(
		messages: BaseMessage[],
		signal?: AbortSignal
	): Promise<AsyncIterable<string>> {
		try {
			const stream = await this.chat.stream(messages, {
				signal: signal
			});

			return (async function* () {
				for await (const chunk of stream) {
					if (signal?.aborted) {
						console.debug('LLM stream aborted by signal.');
						break;
					}
					if (chunk.content) {
						yield chunk.content as string;
					}
				}
			})();
		} catch (error) {
			console.error('Error initiating LLM stream:', error);
			throw error;
		}
	}

	/**
	 * Generates a single text completion using the weak LLM.
	 * @param prompt The prompt string for the weak model.
	 * @param signal An AbortSignal to cancel the LLM request.
	 * @returns A Promise that resolves to the generated string.
	 */
	public async generateText(prompt: string, signal?: AbortSignal): Promise<string> {
		try {
			const response = await this.weakChat.invoke([new HumanMessage(prompt)], {
				signal: signal,
			});
			return response.content as string;
		} catch (error) {
			console.error('Error generating text with weak LLM:', error);
			throw error;
		}
	}
}

let llmServiceInstance: LLMService;

export function getLLMService(): LLMService {
	if (!llmServiceInstance) {
		llmServiceInstance = new LLMService();
	}
	return llmServiceInstance;
}
