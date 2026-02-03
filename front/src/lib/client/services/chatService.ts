import { browser } from '$app/environment';

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
	// Removed abortController and jsonBuffer from here, as they are now managed per-request in Svelte component
	// private abortController: AbortController | null = null;
	// private jsonBuffer: string = '';

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

		// The abortController and jsonBuffer are now managed by the calling component
		// this.abortController = new AbortController();
		// const signal = this.abortController.signal;
		let jsonBuffer = ''; // Use a local buffer for this stream

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

			const reader = response.body.getReader();
			const decoder = new TextDecoder();

			const readStream = async () => {
				try {
					while (true) {
						const { done, value } = await reader.read();
						if (done) {
							console.debug('Chat stream finished for dream:', this.dreamId);
							this.callbacks.onEnd({}); // Indicate stream end, let the component invalidate
							break;
						}

						jsonBuffer += decoder.decode(value, { stream: true });

						let boundary = jsonBuffer.indexOf('\n');
						while (boundary !== -1) {
							const line = jsonBuffer.substring(0, boundary).trim();
							jsonBuffer = jsonBuffer.substring(boundary + 1);

							if (line) {
								try {
									const parsed: ChatStreamChunk = JSON.parse(line);
									this.callbacks.onMessage(parsed);

									if (parsed.final) {
										this.callbacks.onEnd({ message: parsed.message }); // Pass final message
										// No need to call closeStream here, as the component manages the abortController
										// this.closeStream();
										return; // Exit readStream
									}
								} catch (e) {
									console.warn('Failed to parse chat stream message as JSON:', line, e);
									this.callbacks.onError(`Failed to parse chat data: ${line}`);
								}
							}
							boundary = jsonBuffer.indexOf('\n');
						}
					}
				} catch (error) {
					if (signal?.aborted) {
						// Check if the signal was aborted
						console.debug('Chat stream aborted by user for dream:', this.dreamId);
						this.callbacks.onClose?.();
					} else {
						console.error('Chat stream reading error for dream:', this.dreamId, error);
						this.callbacks.onError(`Chat stream error: ${(error as Error).message}`);
						this.callbacks.onEnd({ message: (error as Error).message }); // Indicate failure
					}
				} finally {
					reader.releaseLock();
					// this.abortController = null; // Managed by component
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
