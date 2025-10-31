import { browser } from '$app/environment';
import type { AnalysisStreamChunk } from '$lib/server/langchainService'; // Import the shared type
import type { DreamPromptType } from '$lib/prompts/dreamAnalyst'; // Import DreamPromptType

interface StreamCallbacks {
	onMessage: (data: AnalysisStreamChunk) => void;
	onEnd: (data: { status?: string; message?: string }) => void;
	onError: (error: string) => void;
	onClose?: () => void;
}

export class DreamAnalysisService {
	private dreamId: string;
	private callbacks: StreamCallbacks;
	private abortController: AbortController | null = null;
	private jsonBuffer: string = '';
	private intervalId: ReturnType<typeof setInterval> | null = null; // To store interval ID for polling

	constructor(dreamId: string, callbacks: StreamCallbacks) {
		this.dreamId = dreamId;
		this.callbacks = callbacks;
	}

	public async startStream(promptType: DreamPromptType = 'jungian'): Promise<void> {
		// Add promptType parameter
		if (!browser) {
			console.warn('DreamAnalysisService can only run in the browser.');
			this.callbacks.onError('DreamAnalysisService can only run in the browser.');
			return;
		}

		if (this.abortController) {
			this.closeStream(true); // Ensure any existing stream is closed silently
		}

		this.abortController = new AbortController();
		const signal = this.abortController.signal;
		this.jsonBuffer = ''; // Reset buffer for new stream

		try {
			// Append promptType to the URL
			const url = `/api/dreams/${this.dreamId}/stream-analysis?promptType=${promptType}`;
			const response = await fetch(url, {
				method: 'GET',
				headers: {
					Accept: 'application/x-ndjson'
				},
				signal: signal
			});

			if (!response.ok || !response.body) {
				const errorText = await response.text();
				throw new Error(`Failed to start analysis stream: ${response.status} - ${errorText}`);
			}

			console.debug('Stream started for dream:', this.dreamId);

			const reader = response.body.getReader();
			const decoder = new TextDecoder();

			const readStream = async () => {
				try {
					while (true) {
						const { done, value } = await reader.read();
						if (done) {
							console.debug('Stream finished for dream:', this.dreamId);
							// Process any remaining content in the buffer
							if (this.jsonBuffer.trim()) {
								try {
									const finalChunk = JSON.parse(this.jsonBuffer.trim());
									this.callbacks.onMessage(finalChunk);
								} catch (e) {
									console.warn(
										'Failed to parse final stream buffer as JSON:',
										this.jsonBuffer.trim(),
										e
									);
								}
							}
							this.callbacks.onEnd({}); // Indicate stream end
							break;
						}

						this.jsonBuffer += decoder.decode(value, { stream: true });

						let boundary = this.jsonBuffer.indexOf('\n');
						while (boundary !== -1) {
							const line = this.jsonBuffer.substring(0, boundary).trim();
							this.jsonBuffer = this.jsonBuffer.substring(boundary + 1);

							if (line) {
								try {
									const parsed: AnalysisStreamChunk = JSON.parse(line);
									// Check for finalStatus from the server
									if (parsed.finalStatus) {
										this.callbacks.onEnd({ status: parsed.finalStatus, message: parsed.message });
										this.closeStream(true); // Close the client stream silently
										return; // Exit readStream
									}
									this.callbacks.onMessage(parsed);
								} catch (e) {
									console.warn('Failed to parse stream message as JSON:', line, e);
									this.callbacks.onError(`Failed to parse stream data: ${line}`);
								}
							}
							boundary = this.jsonBuffer.indexOf('\n');
						}
					}
				} catch (error) {
					// Only call onClose if the abortController is null, meaning it was explicitly closed by user
					// If abortController is not null, it means the browser aborted it (e.g., page navigation)
					if (signal.aborted && !this.abortController) {
						console.debug('Stream aborted by user for dream:', this.dreamId);
						this.callbacks.onClose?.();
					} else if (!signal.aborted) {
						console.error('Stream reading error for dream:', this.dreamId, error);
						this.callbacks.onError(`Stream error: ${(error as Error).message}`);
					}
				} finally {
					reader.releaseLock();
					this.abortController = null;
				}
			};

			readStream();
		} catch (error) {
			console.log({ error })
			if (signal.aborted && !this.abortController) {
				console.debug('Fetch aborted by user for dream:', this.dreamId);
				this.callbacks.onClose?.();
			} else if (!signal.aborted) {
				console.error('Fetch initiation error for dream:', this.dreamId, error);
				this.callbacks.onError(`Failed to connect to analysis stream: ${(error as Error).message}`);
				this.abortController = null;
			}
		}
	}

	public async closeStream(silent: boolean = false): Promise<void> {
		if (this.abortController) {
			this.abortController.abort();
			this.abortController = null; // Clear the controller reference immediately
			console.debug('Stream manually closed for dream:', this.dreamId);
			if (!silent) {
				this.callbacks.onClose?.();
				// Make an API call to the server to cancel the background stream
				try {
					const response = await fetch(`/api/dreams/${this.dreamId}/cancel-analysis`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						}
					});
					if (!response.ok) {
						console.error('Failed to send cancel signal to server:', response.statusText);
					} else {
						console.log('Cancel signal sent to server successfully.');
					}
				} catch (error) {
					console.error('Error sending cancel signal to server:', error);
				}
			}
		}
		if (this.intervalId) {
			// Clear any polling interval if it was set
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}
}
