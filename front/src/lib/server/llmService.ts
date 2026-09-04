import OpenAI from 'openai';
import { serverEnv } from '$lib/server/env';

/**
 * All model traffic goes through OpenRouter's OpenAI-compatible API.
 *
 * This previously used langchain's ChatOpenAI. Four packages (langchain,
 * @langchain/core, @langchain/community, and an UNDECLARED @langchain/openai
 * that resolved only through @langchain/community's dependency tree) were
 * wrapping a single OpenAI-compatible HTTP endpoint that will never be swapped -
 * OpenRouter is itself the provider-swap layer.
 *
 * The official SDK also supplies what was missing entirely: per-request timeout,
 * bounded retries, and max_tokens. Without those a hung upstream held a stream
 * processor, its Redis writes and its map entry indefinitely, while the Redis key
 * expired underneath it.
 */

/** The wire shape, so callers no longer construct langchain message objects. */
export type ChatMessage = {
	role: 'system' | 'user' | 'assistant';
	content: string;
};

/** A single analysis should never run longer than this. */
const REQUEST_TIMEOUT_MS = 120_000;
/** Bounds a runaway generation; also bounds cost per request. */
const MAX_TOKENS = 4096;
const TEMPERATURE = 0.7;

class LLMService {
	private client: OpenAI;
	private model: string;
	private weakModel: string;

	constructor() {
		const env = serverEnv();
		this.model = env.OPENROUTER_MODEL_NAME;
		this.weakModel = env.OPENROUTER_WEAK_MODEL;
		this.client = new OpenAI({
			apiKey: env.OPENROUTER_API_KEY,
			baseURL: env.OPENROUTER_BASE_URL,
			timeout: REQUEST_TIMEOUT_MS,
			maxRetries: 2,
			defaultHeaders: env.ORIGIN ? { 'HTTP-Referer': env.ORIGIN } : undefined
		});
	}

	/**
	 * Streams a chat completion as plain text chunks.
	 *
	 * The signal is passed to the SDK, so aborting genuinely cancels the upstream
	 * request rather than just abandoning the iterator.
	 */
	public async streamChatCompletion(
		messages: ChatMessage[],
		signal?: AbortSignal
	): Promise<AsyncIterable<string>> {
		const stream = await this.client.chat.completions.create(
			{
				model: this.model,
				messages,
				temperature: TEMPERATURE,
				max_tokens: MAX_TOKENS,
				stream: true
			},
			{ signal }
		);

		return (async function* () {
			for await (const chunk of stream) {
				const content = chunk.choices[0]?.delta?.content;
				if (content) yield content;
			}
		})();
	}

	/** Single completion from the cheaper model (titles, search keywords). */
	public async generateText(prompt: string, signal?: AbortSignal): Promise<string> {
		const response = await this.client.chat.completions.create(
			{
				model: this.weakModel,
				messages: [{ role: 'user', content: prompt }],
				temperature: TEMPERATURE,
				max_tokens: MAX_TOKENS
			},
			{ signal }
		);
		return response.choices[0]?.message?.content ?? '';
	}
}

let llmServiceInstance: LLMService | undefined;

export function getLLMService(): LLMService {
	if (!llmServiceInstance) llmServiceInstance = new LLMService();
	return llmServiceInstance;
}
