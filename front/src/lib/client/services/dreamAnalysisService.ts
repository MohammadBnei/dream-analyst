import { browser } from '$app/environment';
import type { DreamPromptType } from '$lib/promptTypes';
import { readNdjson } from '$lib/client/ndjson'; // Import DreamPromptType

interface StreamCallbacks {
	onMessage: (data: App.AnalysisStreamChunk) => void;
	onEnd: (data: { status?: string; message?: string }) => void; // Changed to include finalStatus
	onError: (error: string) => void;
	onClose?: () => void;
}

export class DreamAnalysisService {
	private dreamId: string;
	private callbacks: StreamCallbacks;
	private abortController: AbortController | null = null;
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

			const readStream = async () => {
				try {
					for await (const parsed of readNdjson<App.AnalysisStreamChunk>(response.body!)) {
						if (parsed.finalStatus) {
							this.callbacks.onEnd({ status: parsed.finalStatus, message: parsed.message });
							this.closeStream(true);
							return;
						}
						this.callbacks.onMessage(parsed);
					}
					this.callbacks.onEnd({});
				} catch (error) {
					// abortController is nulled by closeStream(), so a null one here means
					// the user closed it deliberately rather than the browser aborting.
					if (signal.aborted && !this.abortController) {
						this.callbacks.onClose?.();
					} else if (!signal.aborted) {
						console.error('Stream reading error for dream:', this.dreamId, error);
						this.callbacks.onError(`Stream error: ${(error as Error).message}`);
						this.callbacks.onEnd({
							status: 'ANALYSIS_FAILED',
							message: (error as Error).message
						});
					}
				} finally {
					this.abortController = null;
				}
			};

			readStream();
		} catch (error) {
			console.log({ error });
			if (signal.aborted && !this.abortController) {
				console.debug('Fetch aborted by user for dream:', this.dreamId);
				this.callbacks.onClose?.();
			} else if (!signal.aborted) {
				console.error('Fetch initiation error for dream:', this.dreamId, error);
				this.callbacks.onError(`Failed to connect to analysis stream: ${(error as Error).message}`);
				this.callbacks.onEnd({ status: 'ANALYSIS_FAILED', message: (error as Error).message }); // Indicate failure
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
