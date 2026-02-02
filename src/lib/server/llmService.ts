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
				signal: signal
			});
			return response.content as string;
		} catch (error) {
			console.error('Error generating text with weak LLM:', error);
			throw error;
		}
	}

	/**
	 * Phase 2: Generate structured dream analysis using function calling.
	 * Returns JSON conforming to StructuredDreamAnalysis schema.
	 * @param systemPrompt The system prompt with psychological knowledge
	 * @param dreamText The raw dream text
	 * @param pastDreamsContext Context from previous dreams (optional)
	 * @param metadataContext User-provided metadata context (optional)
	 * @param signal AbortSignal for cancellation
	 * @returns StructuredDreamAnalysis object
	 */
	public async generateStructuredAnalysis<T = Record<string, unknown>>(
		systemPrompt: string,
		dreamText: string,
		pastDreamsContext: string = '',
		metadataContext: string = '',
		functionSchema: { name: string; description: string; parameters: unknown },
		signal?: AbortSignal
	): Promise<T> {
		try {
			const messages = [
				new SystemMessage(systemPrompt),
				new HumanMessage(`${pastDreamsContext}\n${metadataContext}\n\n**Dream:**\n${dreamText}`)
			];

			// Configure function calling for structured output
			const response = await this.chat.invoke(messages, {
				signal,
				tools: [
					{
						type: 'function',
						function: {
							name: functionSchema.name,
							description: functionSchema.description,
							parameters: functionSchema.parameters
						}
					}
				],
				tool_choice: {
					type: 'function',
					function: { name: functionSchema.name }
				}
			});

			// Extract function call result
			const toolCall = response.additional_kwargs?.tool_calls?.[0];
			if (!toolCall || toolCall.function?.name !== functionSchema.name) {
				throw new Error('LLM did not return expected function call');
			}

			// Parse the function arguments
			const result = JSON.parse(toolCall.function.arguments) as T;
			return result;
		} catch (error) {
			console.error('Error generating structured analysis:', error);
			throw error;
		}
	}

	/**
	 * Phase 2: Stream structured analysis with progressive updates.
	 * This streams the analysis as blocks are completed.
	 * @returns AsyncIterable of analysis chunks
	 */
	public async *streamStructuredAnalysis<T = Record<string, unknown>>(
		systemPrompt: string,
		dreamText: string,
		pastDreamsContext: string = '',
		metadataContext: string = '',
		functionSchema: { name: string; description: string; parameters: unknown },
		signal?: AbortSignal
	): AsyncIterable<{
		type: 'progress' | 'complete' | 'error';
		data?: T;
		progress?: number;
		message?: string;
	}> {
		// For now, fall back to non-streaming since function calling
		// doesn't naturally stream in a useful way
		// In future: implement with custom streaming JSON parser
		yield {
			type: 'progress',
			progress: 0,
			message: 'Generating structured analysis...'
		};

		try {
			const result = await this.generateStructuredAnalysis<T>(
				systemPrompt,
				dreamText,
				pastDreamsContext,
				metadataContext,
				functionSchema,
				signal
			);

			yield {
				type: 'complete',
				data: result
			};
		} catch (error) {
			yield {
				type: 'error',
				message: error instanceof Error ? error.message : 'Unknown error'
			};
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
