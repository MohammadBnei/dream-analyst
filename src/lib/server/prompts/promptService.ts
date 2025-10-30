import {
    DREAM_INTERPRETATION_SYSTEM_PROMPT_JUNGIAN,
    DREAM_INTERPRETATION_SYSTEM_PROMPT_FREUDIAN,
    DREAM_INTERPRETATION_SYSTEM_PROMPT_SIMPLE,
    type DreamPromptType
} from './dreamAnalyst';

/**
 * A service for managing and retrieving various system prompts.
 * Adheres to the Single Responsibility Principle by centralizing prompt management.
 * Adheres to the Open/Closed Principle by allowing easy addition of new prompt types
 * without modifying existing client code (though this class itself would need updates).
 */
export class PromptService {
    private static instance: PromptService;
    private prompts: Record<DreamPromptType, string>;

    private constructor() {
        this.prompts = {
            jungian: DREAM_INTERPRETATION_SYSTEM_PROMPT_JUNGIAN,
            freudian: DREAM_INTERPRETATION_SYSTEM_PROMPT_FREUDIAN,
            simple: DREAM_INTERPRETATION_SYSTEM_PROMPT_SIMPLE,
        };
    }

    /**
     * Gets the singleton instance of the PromptService.
     * @returns The PromptService instance.
     */
    public static getInstance(): PromptService {
        if (!PromptService.instance) {
            PromptService.instance = new PromptService();
        }
        return PromptService.instance;
    }

    /**
     * Retrieves a system prompt based on its type.
     * @param promptType The type of the dream analysis prompt to retrieve.
     * @returns The system prompt string.
     * @throws Error if the promptType is not recognized.
     */
    public getSystemPrompt(promptType: DreamPromptType): string {
        const prompt = this.prompts[promptType];
        if (!prompt) {
            throw new Error(`Unknown dream prompt type: ${promptType}`);
        }
        return prompt;
    }

    /**
     * Returns a list of all available dream prompt types.
     * @returns An array of DreamPromptType.
     */
    public getAvailablePromptTypes(): DreamPromptType[] {
        return Object.keys(this.prompts) as DreamPromptType[];
    }
}

// Export an instance for convenience, following a common pattern for services.
export const promptService = PromptService.getInstance();
