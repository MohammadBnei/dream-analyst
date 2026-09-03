import { browser } from '$app/environment';
import { readNdjson } from '$lib/client/ndjson';

interface ChatStreamChunk {
	content?: string;
	final?: boolean;
	message?: string; // For error or final messages
}

interface ChatCallbacks {
	onMessage: (data: ChatStreamChunk) => void;
	onEnd: (data: { message?: string }) => void; // Changed to include finalStatus
	onError: (error: string) => void;
	onClose?: () => void;
}

export class ClientChatService {
	private dreamId: string;
	private callbacks: ChatCallbacks;
	// private abortController: AbortController | null = null;

	constructor(dreamId: string, callbacks: ChatCallbacks) {
		this.dreamId = dreamId;
		this.callbacks = callbacks;
	}

	/**
	 * Loads the chat history for the current dream from the API.
	 * @returns A promise that resolves to an array of ChatMessage.
	 */
	public async loadHistory(): Promise<App.ChatMessage[]> {
		// Changed return type to ChatMessage[]
		if (!browser) return [];

		try {
			const response = await fetch(`/api/dreams/${this.dreamId}/chat-interpretation`, {
				method: 'GET',
				headers: {
					Accept: 'application/json'
				}
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Failed to load chat history: ${response.status} - ${errorText}`);
			}

			return await response.json();
		} catch (error) {
			console.error('Error loading chat history:', error);
			this.callbacks.onError(`Failed to load chat history: ${(error as Error).message}`);
			return [];
		}
	}

	/**
	 * Sends a user message to the AI and streams the response.
	 * @param message The user's message.
	 * @param signal An AbortSignal to cancel the request.
	 */
	public async sendMessage(message: string, signal?: AbortSignal): Promise<void> {
		if (!browser) {
			console.warn('ClientChatService can only run in the browser.');
			this.callbacks.onError('ClientChatService can only run in the browser.');
			return;
		}

		// this.abortController = new AbortController();
		// const signal = this.abortController.signal;

		try {
			const response = await fetch(`/api/dreams/${this.dreamId}/chat-interpretation`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/x-ndjson'
				},
				body: JSON.stringify({ message }),
				signal: signal // Pass the provided signal
			});

			if (!response.ok || !response.body) {
				const errorText = await response.text();
				throw new Error(`Failed to send message: ${response.status} - ${errorText}`);
			}

			console.debug('Chat stream started for dream:', this.dreamId);

			const readStream = async () => {
				try {
					for await (const parsed of readNdjson<ChatStreamChunk>(response.body!)) {
						this.callbacks.onMessage(parsed);
						if (parsed.final) {
							this.callbacks.onEnd({ message: parsed.message });
							return;
						}
					}
					this.callbacks.onEnd({});
				} catch (error) {
					if (signal?.aborted) {
						this.callbacks.onClose?.();
					} else {
						console.error('Chat stream reading error for dream:', this.dreamId, error);
						this.callbacks.onError(`Chat stream error: ${(error as Error).message}`);
						this.callbacks.onEnd({ message: (error as Error).message });
					}
				}
			};

			readStream();
		} catch (error) {
			if (signal?.aborted) {
				// Check if the signal was aborted
				console.debug('Chat fetch aborted by user for dream:', this.dreamId);
				this.callbacks.onClose?.();
			} else {
				console.error('Chat fetch initiation error for dream:', this.dreamId, error);
				this.callbacks.onError(`Failed to connect to chat stream: ${(error as Error).message}`);
				this.callbacks.onEnd({ message: (error as Error).message }); // Indicate failure
				// this.abortController = null; // Managed by component
			}
		}
	}

	public async deleteMessage(messageId: string): Promise<void> {
		if (!browser) {
			console.warn('ClientChatService can only run in the browser.');
			throw new Error('ClientChatService can only run in the browser.');
		}

		try {
			const response = await fetch(`/api/dreams/${this.dreamId}/chat-messages/${messageId}`, {
				method: 'DELETE',
				headers: {
					Accept: 'application/json'
				}
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to delete chat message');
			}

			// No content expected for a successful delete, but we can return a success message
			console.log(`Chat message ${messageId} deleted successfully.`);
		} catch (error) {
			console.error(`Error deleting chat message ${messageId}:`, error);
			throw error; // Re-throw to be handled by the component
		}
	}

	public closeStream(): void {
		// This method is now primarily for cleanup if the component needs to explicitly close something
		// The abortController is managed by the component for individual requests.
		// If there was a persistent EventSource or WebSocket, this would be used to close it.
		// For fetch streams, the signal handles cancellation.
		console.debug('ClientChatService closeStream called. No active persistent stream to close.');
		this.callbacks.onClose?.();
	}
}
