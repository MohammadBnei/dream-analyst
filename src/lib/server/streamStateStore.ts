import Redis from 'ioredis';
import { env } from '$env/dynamic/private';
import type { AnalysisStreamChunk } from '$lib/server/n8nService'; // Keeping this for now, but ideally would be a generic StreamChunk
import { DreamStatus } from '@prisma/client';

const REDIS_PREFIX = 'stream_state:'; // Changed prefix
const REDIS_EXPIRATION_SECONDS = 60 * 60; // 1 hour
const REDIS_STALL_THRESHOLD_SECONDS = 60 * 5; // 5 minutes

interface StreamState { // Renamed interface
    interpretation: string; // These fields are still specific to 'analysis', will need to be generalized if truly generic
    tags: string[];
    status: DreamStatus; // This status is specific to Dream, will need to be generalized
    lastUpdate: number; // Timestamp of last update (milliseconds)
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


class StreamStateStore { // Renamed class
    private publisher: Redis;

    constructor() {
        this.publisher = getRedisPublisher();
    }

    private getKey(streamId: string): string { // Renamed parameter
        return `${REDIS_PREFIX}${streamId}`;
    }

    private getChannel(streamId: string): string { // Renamed parameter
        return `${REDIS_PREFIX}channel:${streamId}`;
    }

    /**
     * Updates the stored stream state in Redis.
     * @param streamId The ID of the stream.
     * @param chunk The stream chunk to apply.
     * @param isFinal If true, this is the final update.
     * @param refreshExpiration If true, the key's expiration will be refreshed.
     */
    async updateStreamState(streamId: string, chunk: AnalysisStreamChunk, isFinal: boolean = false, refreshExpiration: boolean = true): Promise<void> { // Renamed method
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
                status: DreamStatus.PENDING_ANALYSIS, // Still specific to DreamStatus
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
        // Update status
        if (chunk.status) {
            currentState.status = chunk.status;
        }
        if (chunk.finalStatus) {
            // This assumes chunk.finalStatus maps directly to DreamStatus
            currentState.status = chunk.finalStatus as DreamStatus;
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
    async getStreamState(streamId: string): Promise<StreamState | null> { // Renamed method
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
     * @param streamId The ID of the stream.
     * @returns True if stream is ongoing, false otherwise.
     */
    async isStreamOngoing(streamId: string): Promise<boolean> { // Renamed method
        const state = await this.getStreamState(streamId);
        if (state?.status === DreamStatus.PENDING_ANALYSIS) { // Still specific to DreamStatus
            const now = Date.now();
            if ((now - state.lastUpdate) / 1000 > REDIS_STALL_THRESHOLD_SECONDS) {
                console.warn(`Stream ${streamId}: Detected stalled stream (last update ${state.lastUpdate}). Clearing state.`);
                await this.clearStreamState(streamId); // Renamed method
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
    async markStreamStarted(streamId: string): Promise<void> { // Renamed method
        const key = this.getKey(streamId);
        const initialState: StreamState = {
            interpretation: '',
            tags: [],
            status: DreamStatus.PENDING_ANALYSIS, // Still specific to DreamStatus
            lastUpdate: Date.now()
        };
        await this.publisher.setex(key, REDIS_EXPIRATION_SECONDS, JSON.stringify(initialState));
    }

    /**
     * Clears the stream state from Redis and publishes a final message.
     * @param streamId The ID of the stream.
     */
    async clearStreamState(streamId: string): Promise<void> { // Renamed method
        const key = this.getKey(streamId);
        const channel = this.getChannel(streamId);
        await this.publisher.del(key);
        // Publish a final message indicating the state has been cleared
        await this.publisher.publish(channel, JSON.stringify({ finalStatus: DreamStatus.COMPLETED, message: 'Stream state cleared from Redis.' })); // Still specific to DreamStatus
        console.log(`Stream ${streamId}: Stream state cleared from Redis.`);
    }

    /**
     * Publishes a stream update to the Redis Pub/Sub channel.
     * @param streamId The ID of the stream.
     * @param chunk The stream chunk to publish.
     */
    async publishUpdate(streamId: string, chunk: AnalysisStreamChunk): Promise<void> { // Renamed parameter
        const channel = this.getChannel(streamId);
        await this.publisher.publish(channel, JSON.stringify(chunk));
    }

    /**
     * Publishes a cancellation signal to the Redis Pub/Sub channel for a specific stream.
     * Also clears the stream state from Redis immediately.
     * @param streamId The ID of the stream to cancel.
     */
    async publishCancellation(streamId: string): Promise<void> {
        const channel = this.getChannel(streamId);
        const cancellationMessage: AnalysisStreamChunk = {
            finalStatus: DreamStatus.ANALYSIS_FAILED, // Using ANALYSIS_FAILED to indicate a non-successful termination
            message: 'Analysis cancelled by user.'
        };
        await this.publisher.publish(channel, JSON.stringify(cancellationMessage));
        console.log(`Stream ${streamId}: Published cancellation signal.`);
        // Immediately clear the Redis state upon cancellation
        await this.clearStreamState(streamId);
    }

    /**
     * Subscribes to stream updates for a specific stream.
     * Returns a dedicated Redis client instance for this subscription.
     * @param streamId The ID of the stream.
     * @param callback The function to call with each parsed message.
     * @returns A dedicated Redis subscriber client.
     */
    subscribeToUpdates(streamId: string, callback: (message: AnalysisStreamChunk) => void): AisRedis { // Renamed parameter
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
    async unsubscribeFromUpdates(subscriber: AisRedis, streamId: string): Promise<void> { // Renamed parameter
        const channel = this.getChannel(streamId);
        try {
            if (subscriber.status === 'connect') { // Changed from 'connected' to 'connect' to match ioredis status
                await subscriber.unsubscribe(channel);
                await subscriber.quit();
                console.log(`Unsubscribed from Redis channel: ${channel} and quit client.`);
            } else {
                console.log(`Redis subscriber for ${streamId} already disconnected or not connected.`);
            }
        } catch (e) {
            console.error(`Error unsubscribing/quitting Redis client for ${streamId}:`, e);
        }
    }
}

let streamStateStoreInstance: StreamStateStore; // Renamed instance

export async function getStreamStateStore(): Promise<StreamStateStore> { // Renamed function
    if (!streamStateStoreInstance) {
        streamStateStoreInstance = new StreamStateStore();
    }
    return streamStateStoreInstance;
}
