import Redis from 'ioredis';
import { env } from '$env/dynamic/private';
import type { AnalysisStreamChunk } from '$lib/server/n8nService';
import { DreamStatus } from '@prisma/client';

const REDIS_PREFIX = 'dream_analysis:';
const REDIS_EXPIRATION_SECONDS = 60 * 60; // 1 hour
const REDIS_STALL_THRESHOLD_SECONDS = 60 * 5; // 5 minutes

interface AnalysisState {
    interpretation: string;
    tags: string[];
    status: DreamStatus;
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


class AnalysisStore {
    private publisher: Redis;

    constructor() {
        this.publisher = getRedisPublisher();
    }

    private getKey(dreamId: string): string {
        return `${REDIS_PREFIX}${dreamId}`;
    }

    private getChannel(dreamId: string): string {
        return `${REDIS_PREFIX}channel:${dreamId}`;
    }

    /**
     * Updates the stored analysis state in Redis.
     * @param dreamId The ID of the dream.
     * @param chunk The analysis chunk to apply.
     * @param isFinal If true, this is the final update.
     * @param refreshExpiration If true, the key's expiration will be refreshed.
     */
    async updateAnalysis(dreamId: string, chunk: AnalysisStreamChunk, isFinal: boolean = false, refreshExpiration: boolean = true): Promise<void> {
        const key = this.getKey(dreamId);
        let currentState: AnalysisState | null = null;

        try {
            const rawState = await this.publisher.get(key);
            if (rawState) {
                currentState = JSON.parse(rawState);
            }
        } catch (e) {
            console.error(`Failed to parse existing Redis state for ${dreamId}:`, e);
            currentState = null; // If parsing fails, start with a fresh state
        }

        if (!currentState) {
            currentState = {
                interpretation: '',
                tags: [],
                status: DreamStatus.PENDING_ANALYSIS,
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
            currentState.status = chunk.finalStatus;
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
     * Retrieves the current analysis state from Redis.
     * @param dreamId The ID of the dream.
     * @returns The analysis state or null if not found.
     */
    async getAnalysis(dreamId: string): Promise<AnalysisState | null> {
        const key = this.getKey(dreamId);
        const rawState = await this.publisher.get(key);
        if (rawState) {
            try {
                return JSON.parse(rawState);
            } catch (e) {
                console.error(`Failed to parse Redis state for ${dreamId}:`, e);
                return null;
            }
        }
        return null;
    }

    /**
     * Checks if an analysis is currently ongoing and not stalled.
     * @param dreamId The ID of the dream.
     * @returns True if analysis is ongoing, false otherwise.
     */
    async isAnalysisOngoing(dreamId: string): Promise<boolean> {
        const state = await this.getAnalysis(dreamId);
        if (state?.status === DreamStatus.PENDING_ANALYSIS) {
            const now = Date.now();
            if ((now - state.lastUpdate) / 1000 > REDIS_STALL_THRESHOLD_SECONDS) {
                console.warn(`Dream ${dreamId}: Detected stalled analysis (last update ${state.lastUpdate}). Clearing state.`);
                await this.clearAnalysis(dreamId);
                return false;
            }
            return true;
        }
        return false;
    }

    /**
     * Marks an analysis as started in Redis.
     * @param dreamId The ID of the dream.
     */
    async markAnalysisStarted(dreamId: string): Promise<void> {
        const key = this.getKey(dreamId);
        const initialState: AnalysisState = {
            interpretation: '',
            tags: [],
            status: DreamStatus.PENDING_ANALYSIS,
            lastUpdate: Date.now()
        };
        await this.publisher.setex(key, REDIS_EXPIRATION_SECONDS, JSON.stringify(initialState));
    }

    /**
     * Clears the analysis state from Redis and publishes a final message.
     * @param dreamId The ID of the dream.
     */
    async clearAnalysis(dreamId: string): Promise<void> {
        const key = this.getKey(dreamId);
        const channel = this.getChannel(dreamId);
        await this.publisher.del(key);
        await this.publisher.publish(channel, JSON.stringify({ finalStatus: DreamStatus.COMPLETED, message: 'Analysis state cleared from Redis.' }));
        console.log(`Dream ${dreamId}: Analysis state cleared from Redis.`);
    }

    /**
     * Publishes an analysis update to the Redis Pub/Sub channel.
     * @param dreamId The ID of the dream.
     * @param chunk The analysis chunk to publish.
     */
    async publishUpdate(dreamId: string, chunk: AnalysisStreamChunk): Promise<void> {
        const channel = this.getChannel(dreamId);
        await this.publisher.publish(channel, JSON.stringify(chunk));
    }

    /**
     * Subscribes to analysis updates for a specific dream.
     * Returns a dedicated Redis client instance for this subscription.
     * @param dreamId The ID of the dream.
     * @param callback The function to call with each parsed message.
     * @returns A dedicated Redis subscriber client.
     */
    subscribeToUpdates(dreamId: string, callback: (message: AnalysisStreamChunk) => void): AisRedis {
        const subscriber = getRedisSubscriber(); // Get a new subscriber client
        const channel = this.getChannel(dreamId);

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
                    console.error(`Failed to parse Pub/Sub message for ${dreamId}:`, e);
                }
            }
        });

        return subscriber;
    }

    /**
     * Unsubscribes and quits a dedicated Redis subscriber client.
     * @param subscriber The Redis client instance returned by `subscribeToUpdates`.
     * @param dreamId The ID of the dream.
     */
    async unsubscribeFromUpdates(subscriber: AisRedis, dreamId: string): Promise<void> {
        const channel = this.getChannel(dreamId);
        try {
            if (subscriber.status === 'connected') {
                await subscriber.unsubscribe(channel);
                await subscriber.quit();
                console.log(`Unsubscribed from Redis channel: ${channel} and quit client.`);
            } else {
                console.log(`Redis subscriber for ${dreamId} already disconnected or not connected.`);
            }
        } catch (e) {
            console.error(`Error unsubscribing/quitting Redis client for ${dreamId}:`, e);
        }
    }
}

let analysisStoreInstance: AnalysisStore;

export async function getAnalysisStore(): Promise<AnalysisStore> {
    if (!analysisStoreInstance) {
        analysisStoreInstance = new AnalysisStore();
    }
    return analysisStoreInstance;
}
