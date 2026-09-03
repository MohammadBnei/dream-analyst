/**
 * The prompt-type identifiers, client-safe.
 *
 * Kept apart from the prompt TEXT, which lives under $lib/server/prompts and must
 * never reach the browser. The UI needs the four names to render a picker; it has
 * no business knowing what the prompts say.
 */
export const DREAM_PROMPT_TYPES = ['jungian', 'freudian', 'simple', 'islamic'] as const;

export type DreamPromptType = (typeof DREAM_PROMPT_TYPES)[number];
