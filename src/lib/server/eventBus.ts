/**
 * EventBus - Lightweight in-memory Pub/Sub for inter-actor communication
 * 
 * Supports:
 * - Event subscription (on)
 * - Event emission (emit)
 * - Waiting for specific events (waitFor)
 * - Event history for debugging
 */

import { EventType } from "$lib/types";


type EventHandler = (data: any) => void | Promise<void>;

interface EventRecord {
	event: string | EventType;
	data: any;
	timestamp: Date;
}

export class EventBus {
	private handlers = new Map<string | EventType, EventHandler[]>();
	private history: EventRecord[] = [];
	private maxHistorySize = 1000;
	private debugEnabled = process.env.NODE_ENV !== 'production';

	/**
	 * Subscribe to an event
	 * @param event Event name to listen for
	 * @param handler Function to call when event is emitted
	 */
	on(event: string | EventType, handler: EventHandler): void {
		if (!this.handlers.has(event)) {
			this.handlers.set(event, []);
		}
		this.handlers.get(event)!.push(handler);
	}

	/**
	 * Unsubscribe from an event
	 * @param event Event name
	 * @param handler Handler function to remove
	 */
	off(event: string | EventType, handler: EventHandler): void {
		const handlers = this.handlers.get(event);
		if (handlers) {
			const index = handlers.indexOf(handler);
			if (index > -1) {
				handlers.splice(index, 1);
			}
		}
	}

	/**
	 * Emit an event to all subscribers
	 * @param event Event name
	 * @param data Event data
	 */
	async emit(event: string | EventType, data: any): Promise<void> {
		if (this.debugEnabled && event !== EventType.INTERPRETATION_CHUNK) {
			console.debug(`[EventBus] 📡 Emitting event: ${event.toString()}`, {
				dreamId: data?.dreamId,
				data: typeof data === 'object' ? { ...data, signal: undefined } : data
			});
		}

		// Record event in history
		this.history.push({ event, data, timestamp: new Date() });
		if (this.history.length > this.maxHistorySize) {
			this.history.shift();
		}

		const handlers = this.handlers.get(event) || [];
		
		// Execute all handlers in parallel
		await Promise.all(
			handlers.map(async (handler) => {
				try {
					await handler(data);
				} catch (error) {
					console.error(`EventBus: Error in handler for event "${event}":`, error);
					// Don't throw - one handler failure shouldn't break others
				}
			})
		);
	}

	/**
	 * Wait for a specific event to be emitted
	 * @param event Event name to wait for
	 * @param timeout Timeout in milliseconds (default: 30000)
	 * @param filter Optional filter function to only resolve on specific event data
	 * @returns Promise that resolves with the event data
	 */
	async waitFor(
		event: string | EventType,
		timeout = 30000,
		filter?: (data: any) => boolean
	): Promise<any> {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.off(event, handler);
				reject(new Error(`EventBus: Timeout waiting for event "${event}"`));
			}, timeout);

			const handler = (data: any) => {
				// If filter provided, only resolve if it passes
				if (filter && !filter(data)) {
					return;
				}

				clearTimeout(timer);
				this.off(event, handler);
				resolve(data);
			};

			this.on(event, handler);
		});
	}

	/**
	 * Get event history for debugging
	 * @param eventFilter Optional event name to filter by
	 * @param limit Max number of records to return
	 */
	getHistory(eventFilter?: string | EventType, limit = 100): EventRecord[] {
		let filtered = this.history;
		
		if (eventFilter) {
			filtered = filtered.filter((record) => record.event === eventFilter);
		}

		return filtered.slice(-limit);
	}

	/**
	 * Clear all handlers and history
	 */
	clear(): void {
		this.handlers.clear();
		this.history = [];
	}

	/**
	 * Get all currently registered event types
	 */
	getRegisteredEvents(): (string | EventType)[] {
		return Array.from(this.handlers.keys());
	}
}

// Singleton instance
let eventBusInstance: EventBus;

export function getEventBus(): EventBus {
	if (!eventBusInstance) {
		eventBusInstance = new EventBus();
	}
	return eventBusInstance;
}
