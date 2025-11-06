import { env } from '$env/dynamic/private';
import { ChatOpenAI } from '@langchain/openai';
import type { BaseMessage } from '@langchain/core/messages';

const OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL_NAME = env.OPENROUTER_MODEL_NAME || 'mistralai/mistral-7b-instruct-v0.2';
const YOUR_SITE_URL = env.ORIGIN;

class LLMService {
	private chat: ChatOpenAI;

	constructor() {
		if (!OPENROUTER_API_KEY) {
			throw new Error('OPENROUTER_API_KEY is not defined');
		}

		this.chat = new ChatOpenAI({
			model: OPENROUTER_MODEL_NAME,
			temperature: 0.7, // A reasonable default for creative tasks
			streaming: true,
			apiKey: OPENROUTER_API_KEY,
			configuration: {
				baseURL: 'https://openrouter.ai/api/v1',
				defaultHeaders: {
					...(YOUR_SITE_URL && { 'HTTP-Referer': YOUR_SITE_URL })
				}
			}
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
}

let llmServiceInstance: LLMService;

export function getLLMService(): LLMService {
	if (!llmServiceInstance) {
		llmServiceInstance = new LLMService();
	}
	return llmServiceInstance;
}
