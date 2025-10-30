import Redis from 'ioredis';
import { env } from '$env/dynamic/private';
import type { AnalysisStreamChunk } from '$lib/server/n8nService';
import { DreamStatus } from '@prisma/client'; // Keep for now, but will be replaced by generic StreamStatus

const REDIS_PREFIX = 'stream_state:';
const REDIS_EXPIRATION_SECONDS = 60 * 3;
const REDIS_STALL_THRESHOLD_SECONDS = 15;

// NEW: Define a generic StreamStatus enum
export enum StreamStatus {
    PENDING = 'PENDING',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    // CANCELLED = 'CANCELLED', // Removed CANCELLED status
    STALLED = 'STALLED', // New status for detected stalled streams
}

// NEW: Update StreamState interface to use generic StreamStatus
interface StreamState {
    interpretation: string;
    tags: string[];
    status: StreamStatus; // Use generic StreamStatus
    lastUpdate: number;
    finalMessage?: string; // Optional message for final states
}

// Dedicated client for publishing (and general commands like GET/SET/DEL)
let publisherClient: Redis | null = null;

/**
 * Provides a singleton Redis client for general commands and publishing.
 * This client should NOT be used for subscribing, as subscribers block.
 */
export function getRedisPublisher(): Redis {
    if (!publisherClient) {
        if (!env.REDIS_URL) {
            throw new Error('REDIS_URL is not defined');
        }
        publisherClient = new Redis(env.REDIS_URL);

        publisherClient.on('connect', () => {
            console.log('Redis publisher client connected.');
        });

        publisherClient.on('error', (err) => {
            console.error('Redis publisher client error:', err);
        });
    }
    return publisherClient;
}

/**
 * Closes the Redis publisher client.
 */
export async function closeRedisPublisher(): Promise<void> {
    if (publisherClient) {
        await publisherClient.quit();
        publisherClient = null;
        console.log('Redis publisher connection closed.');
    }
}

/**
 * Provides a new, dedicated Redis client for subscribing to Pub/Sub channels.
 * Each subscriber needs its own client instance.
 */
export function getRedisSubscriber(): Redis {
    if (!env.REDIS_URL) {
        throw new Error('REDIS_URL is not defined');
    }
    const subscriber = new Redis(env.REDIS_URL);
    subscriber.on('error', (err) => {
        console.error('Redis subscriber client error:', err);
    });
    return subscriber;
}

// Type alias for the Redis client returned by getRedisSubscriber
export type AisRedis = ReturnType<typeof getRedisSubscriber>;


class StreamStateStore {
    private publisher: Redis;

    constructor() {
        this.publisher = getRedisPublisher();
    }

    private getKey(streamId: string): string {
        return `${REDIS_PREFIX}${streamId}`;
    }

    private getChannel(streamId: string): string {
        return `${REDIS_PREFIX}channel:${streamId}`;
    }

    /**
     * Updates the stored stream state in Redis.
     * @param streamId The ID of the stream.
     * @param chunk The stream chunk to apply.
     * @param isFinal If true, this is the final update.
     * @param refreshExpiration If true, the key's expiration will be refreshed.
     */
    async updateStreamState(streamId: string, chunk: AnalysisStreamChunk, isFinal: boolean = false, refreshExpiration: boolean = true): Promise<void> {
        const key = this.getKey(streamId);
        let currentState: StreamState | null = null;

        try {
            const rawState = await this.publisher.get(key);
            if (rawState) {
                currentState = JSON.parse(rawState);
            }
        } catch (e) {
            console.error(`Failed to parse existing Redis state for ${streamId}:`, e);
            currentState = null; // If parsing fails, start with a fresh state
        }

        if (!currentState) {
            currentState = {
                interpretation: '',
                tags: [],
                status: StreamStatus.PENDING, // Use generic StreamStatus
                lastUpdate: Date.now()
            };
        }

        // Update interpretation
        if (chunk.content) {
            currentState.interpretation += chunk.content;
        }
        // Update tags (replace with latest set)
        if (chunk.tags && chunk.tags.length > 0) {
            currentState.tags = chunk.tags;
        }

        // NEW: Handle status updates more generically
        if (chunk.status) {
            // Map DreamStatus to generic StreamStatus if necessary, or assume direct compatibility for now
            currentState.status = chunk.status === DreamStatus.PENDING_ANALYSIS ? StreamStatus.IN_PROGRESS : StreamStatus.IN_PROGRESS; // Simplified mapping
        }
        if (chunk.finalStatus) {
            // Map n8n's finalStatus to generic StreamStatus
            currentState.status = chunk.finalStatus === 'COMPLETED' ? StreamStatus.COMPLETED : StreamStatus.FAILED;
            currentState.finalMessage = chunk.message; // Store final message
        } else if (isFinal && !chunk.status && !chunk.finalStatus) {
            // If it's marked as final but no specific status is provided, assume completed
            currentState.status = StreamStatus.COMPLETED;
        }

        currentState.lastUpdate = Date.now();

        const serializedState = JSON.stringify(currentState);

        if (isFinal || refreshExpiration) {
            await this.publisher.setex(key, REDIS_EXPIRATION_SECONDS, serializedState);
        } else {
            await this.publisher.set(key, serializedState);
        }
    }

    /**
     * Retrieves the current stream state from Redis.
     * @param streamId The ID of the stream.
     * @returns The stream state or null if not found.
     */
    async getStreamState(streamId: string): Promise<StreamState | null> {
        const key = this.getKey(streamId);
        const rawState = await this.publisher.get(key);
        if (rawState) {
            try {
                return JSON.parse(rawState);
            } catch (e) {
                console.error(`Failed to parse Redis state for ${streamId}:`, e);
                return null;
            }
        }
        return null;
    }

    /**
     * Checks if a stream is currently ongoing and not stalled.
     * If stalled, it will return false and also clear the stalled state from Redis.
     * @param streamId The ID of the stream.
     * @returns True if stream is ongoing, false otherwise.
     */
    async isStreamOngoing(streamId: string): Promise<boolean> {
        const state = await this.getStreamState(streamId);
        if (state && (state.status === StreamStatus.PENDING || state.status === StreamStatus.IN_PROGRESS)) {
            const now = Date.now();
            console.log({ state, last: (now - state.lastUpdate) / 1000, REDIS_STALL_THRESHOLD_SECONDS })
            if ((now - state.lastUpdate) / 1000 > REDIS_STALL_THRESHOLD_SECONDS) {
                console.warn(`Stream ${streamId}: Detected stalled stream (last update ${state.lastUpdate}). Marking as FAILED and clearing state.`);
                // Mark as failed and publish a final update
                await this.updateStreamState(streamId, {
                    finalStatus: 'ANALYSIS_FAILED', // Use n8nService's finalStatus type
                    message: 'Stream stalled and automatically cleared.'
                }, true);
                await this.publishUpdate(streamId, {
                    finalStatus: 'ANALYSIS_FAILED',
                    message: 'Stream stalled and automatically cleared.'
                });
                await this.clearStreamState(streamId); // Clear the stalled state
                return false;
            }
            return true;
        }
        return false;
    }

    /**
     * Marks a stream as started in Redis.
     * @param streamId The ID of the stream.
     */
    async markStreamStarted(streamId: string): Promise<void> {
        const key = this.getKey(streamId);
        const initialState: StreamState = {
            interpretation: '',
            tags: [],
            status: StreamStatus.PENDING, // Use generic StreamStatus
            lastUpdate: Date.now()
        };
        await this.publisher.setex(key, REDIS_EXPIRATION_SECONDS, JSON.stringify(initialState));
    }

    /**
     * Clears the stream state from Redis.
     * This method only deletes the key, it does not publish a final message.
     * Final messages should be published by the entity that determines the final state (e.g., StreamProcessor).
     * @param streamId The ID of the stream.
     */
    async clearStreamState(streamId: string): Promise<void> {
        const key = this.getKey(streamId);
        await this.publisher.del(key);
        console.log(`Stream ${streamId}: Stream state cleared from Redis.`);
    }

    /**
     * Publishes a stream update to the Redis Pub/Sub channel.
     * @param streamId The ID of the stream.
     * @param chunk The stream chunk to publish.
     */
    async publishUpdate(streamId: string, chunk: AnalysisStreamChunk): Promise<void> {
        const channel = this.getChannel(streamId);
        await this.publisher.publish(channel, JSON.stringify(chunk));
    }

    /**
     * Subscribes to stream updates for a specific stream.
     * Returns a dedicated Redis client instance for this subscription.
     * @param streamId The ID of the stream.
     * @param callback The function to call with each parsed message.
     * @returns A dedicated Redis subscriber client.
     */
    subscribeToUpdates(streamId: string, callback: (message: AnalysisStreamChunk) => void): AisRedis {
        const subscriber = getRedisSubscriber(); // Get a new subscriber client
        const channel = this.getChannel(streamId);

        subscriber.subscribe(channel, (err) => {
            if (err) {
                console.error(`Failed to subscribe to Redis channel ${channel}:`, err);
                subscriber.quit(); // Quit on error
                return;
            }
            console.log(`Subscribed to Redis channel: ${channel}`);
        });

        subscriber.on('message', (ch, message) => {
            if (ch === channel) {
                try {
                    const parsedMessage: AnalysisStreamChunk = JSON.parse(message);
                    callback(parsedMessage);
                } catch (e) {
                    console.error(`Failed to parse Pub/Sub message for ${streamId}:`, e);
                }
            }
        });

        return subscriber;
    }

    /**
     * Unsubscribes and quits a dedicated Redis subscriber client.
     * @param subscriber The Redis client instance returned by `subscribeToUpdates`.
     * @param streamId The ID of the stream.
     */
    async unsubscribeFromUpdates(subscriber: AisRedis, streamId: string): Promise<void> {
        const channel = this.getChannel(streamId);
        try {
            // Check if the subscriber is still active before attempting to unsubscribe/quit
            if (subscriber.status === 'connect' || subscriber.status === 'connecting') {
                await subscriber.unsubscribe(channel);
                await subscriber.quit();
                console.log(`Unsubscribed from Redis channel: ${channel} and quit client.`);
            } else {
                console.log(`Redis subscriber for ${streamId} already disconnected or not connected. Status: ${subscriber.status}`);
            }
        } catch (e) {
            console.error(`Error unsubscribing/quitting Redis client for ${streamId}:`, e);
        }
    }
}

let streamStateStoreInstance: StreamStateStore;

export async function getStreamStateStore(): Promise<StreamStateStore> {
    if (!streamStateStoreInstance) {
        streamStateStoreInstance = new StreamStateStore();
    }
    return streamStateStoreInstance;
}
