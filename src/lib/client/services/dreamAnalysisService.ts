import type { AnalysisStreamChunk } from '$lib/server/n8nService'; // Import the shared type

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

    public async startStream(): Promise<void> {
        if (this.abortController) {
            this.closeStream(); // Ensure any existing stream is closed
        }

        this.abortController = new AbortController();
        const signal = this.abortController.signal;
        this.jsonBuffer = ''; // Reset buffer for new stream

        try {
            const response = await fetch(`/api/dreams/${this.dreamId}/stream-analysis`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/x-ndjson'
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
                                    console.warn('Failed to parse final stream buffer as JSON:', this.jsonBuffer.trim(), e);
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
                                        this.closeStream(); // Close the client stream
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
                    if (signal.aborted) {
                        console.debug('Stream aborted by user for dream:', this.dreamId);
                        this.callbacks.onClose?.();
                    } else {
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
            if (signal.aborted) {
                console.debug('Fetch aborted by user for dream:', this.dreamId);
                this.callbacks.onClose?.();
            } else {
                console.error('Fetch initiation error for dream:', this.dreamId, error);
                this.callbacks.onError(`Failed to connect to analysis stream: ${(error as Error).message}`);
                this.abortController = null;
            }
        }
    }

    public closeStream(): void {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
            console.debug('Stream manually closed for dream:', this.dreamId);
            this.callbacks.onClose?.();
        }
        if (this.intervalId) { // Clear any polling interval if it was set
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}
