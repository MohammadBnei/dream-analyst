// src/lib/client/utils/streamParser.ts

/**
 * Parses a raw EventSource message data string.
 * Handles potential JSON parsing errors and extracts relevant fields.
 * @param data The raw data string from an EventSource message.
 * @returns An object containing parsed data, or null if parsing fails.
 */
export function parseStreamMessage(data: string): { content?: string; tags?: string[]; status?: string; message?: string } | null {
    try {
        const parsed = JSON.parse(data);
        return parsed;
    } catch (e) {
        console.warn('Failed to parse stream message as JSON:', data, e);
        // If it's not JSON, we might still want to return it as a plain message
        return { message: data };
    }
}
