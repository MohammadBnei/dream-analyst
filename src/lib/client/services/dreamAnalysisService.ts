// src/lib/client/services/dreamAnalysisService.ts
import { parseStreamMessage } from '$lib/client/utils/streamParser';

interface StreamCallbacks {
    onMessage: (data: { content?: string; tags?: string[]; status?: string; message?: string }) => void;
    onEnd: (data: { status?: string; message?: string }) => void;
    onError: (error: string) => void;
    onClose?: () => void;
}

export class DreamAnalysisService {
    private eventSource: EventSource | null = null;
    private dreamId: string;
    private callbacks: StreamCallbacks;

    constructor(dreamId: string, callbacks: StreamCallbacks) {
        this.dreamId = dreamId;
        this.callbacks = callbacks;
    }

    /**
     * Initiates the SSE stream for dream analysis.
     */
    public startStream(): void {
        if (this.eventSource) {
            this.closeStream(); // Ensure any existing stream is closed
        }

        this.eventSource = new EventSource(`/api/dreams/${this.dreamId}/stream-analysis`);

        this.eventSource.onopen = () => {
            console.log('EventSource connected for dream:', this.dreamId);
        };

        this.eventSource.onmessage = (event) => {
            const parsedData = parseStreamMessage(event.data);
            if (parsedData) {
                this.callbacks.onMessage(parsedData);
            }
        };

        this.eventSource.addEventListener('end', (event) => {
            console.log('Analysis stream ended for dream:', this.dreamId);
            const parsedData = parseStreamMessage(event.data);
            this.callbacks.onEnd(parsedData || { status: 'completed' });
            this.closeStream();
        });

        this.eventSource.addEventListener('error', (event) => {
            console.error('EventSource error for dream:', this.dreamId, event);
            let errorMessage = 'An unknown streaming error occurred.';
            if (event instanceof MessageEvent && event.data) {
                const parsedData = parseStreamMessage(event.data);
                errorMessage = parsedData?.message || errorMessage;
            } else if (event instanceof Event && (event.target as EventSource)?.readyState === EventSource.CLOSED) {
                errorMessage = 'Stream connection closed unexpectedly.';
            }
            this.callbacks.onError(errorMessage);
            this.closeStream();
        });
    }

    /**
     * Closes the SSE stream if it's open.
     */
    public closeStream(): void {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
            console.log('EventSource closed for dream:', this.dreamId);
            this.callbacks.onClose?.();
        }
    }
}
