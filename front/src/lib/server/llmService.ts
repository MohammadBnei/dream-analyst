import OpenAI from 'openai';
import { serverEnv } from '$lib/server/env';
import { strongModel, weakModel } from '$lib/server/settings';

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

/**
 * Pull the JSON value out of a model reply.
 *
 * Picks the opening bracket with the SMALLER index, then the LAST occurrence
 * of ITS OWN matching partner. The obvious rule - first bracket to last
 * bracket of either kind - breaks on a reply like
 * `[{"a":1}] j'espère que ça aide {sourire}`, where it slices to the trailing
 * brace and throws. Exported for the unit test.
 */
export function sliceJson(text: string): string {
	const firstArr = text.indexOf('[');
	const firstObj = text.indexOf('{');
	if (firstArr === -1 && firstObj === -1) throw new Error('no JSON in model output');
	const useArray = firstArr !== -1 && (firstObj === -1 || firstArr < firstObj);
	const start = useArray ? firstArr : firstObj;
	const end = text.lastIndexOf(useArray ? ']' : '}');
	if (end <= start) throw new Error('no JSON in model output');
	return text.slice(start, end + 1);
}

class LLMService {
	private client: OpenAI;

	// Model names are NOT captured here. They are resolved per call from
	// `app_setting`, falling back to the environment, so an operator can change
	// a model without a deploy or a restart. The client itself (key, base URL,
	// timeout) is static and stays in the constructor.

	constructor() {
		const env = serverEnv();
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
				model: await strongModel(),
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

	/**
	 * A completion whose answer is expected to be JSON.
	 *
	 * Deliberately does NOT send `response_format`. The model name is a free-form
	 * setting with no allowlist, so a model that does not support json_object
	 * would turn a configuration value into a request-time 400. Fence-stripping
	 * is three lines and cannot fail that way.
	 *
	 * ponytail: prompt-only JSON. Upgrade path once the model is pinned: send
	 * `response_format: { type: 'json_schema', strict: true }` and delete sliceJson.
	 */
	public async generateJson(prompt: string, model: string, signal?: AbortSignal): Promise<unknown> {
		const response = await this.client.chat.completions.create(
			{
				model,
				messages: [{ role: 'user', content: prompt }],
				// Canonicalisation is a judgement, not a creative act: the same dream
				// should resolve the same way twice.
				temperature: 0,
				max_tokens: MAX_TOKENS
			},
			{ signal }
		);
		return JSON.parse(sliceJson(response.choices[0]?.message?.content ?? ''));
	}

	/** Single completion from the cheaper model (titles, search keywords). */
	public async generateText(prompt: string, signal?: AbortSignal): Promise<string> {
		const response = await this.client.chat.completions.create(
			{
				model: await weakModel(),
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
