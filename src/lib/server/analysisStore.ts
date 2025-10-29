import { getRedisClient } from './redis';
import type { AnalysisStreamChunk } from './n8nService';
import Redis from 'ioredis'; // Import Redis for subscriber client

const REDIS_PREFIX = 'dream_analysis:';
const REDIS_EXPIRATION_SECONDS = 60 * 60; // Store analysis state for 1 hour

interface AnalysisState {
    interpretation: string;
    tags: string[];
    status: 'pending_analysis' | 'completed' | 'analysis_failed';
    lastUpdate: number; // Timestamp of last update
}

class AnalysisStore {
    private redis: ReturnType<typeof getRedisClient>;

    constructor() {
        this.redis = getRedisClient();
    }

    private getKey(dreamId: string): string {
        return `${REDIS_PREFIX}${dreamId}`;
    }

    private getChannel(dreamId: string): string {
        return `${REDIS_PREFIX}channel:${dreamId}`;
    }

    /**
     * Initializes or updates the analysis state in Redis.
     * @param dreamId The ID of the dream.
     * @param chunk The analysis chunk containing updates.
     * @param isFinal If true, sets the final status and potentially clears the key.
     */
    async updateAnalysis(dreamId: string, chunk: AnalysisStreamChunk, isFinal: boolean = false): Promise<void> {
        const key = this.getKey(dreamId);
        let currentState: AnalysisState | null = null;

        try {
            const rawState = await this.redis.get(key);
            if (rawState) {
                currentState = JSON.parse(rawState);
            }
        } catch (e) {
            console.error(`Failed to parse Redis state for ${dreamId}:`, e);
            currentState = null; // Treat as no state if parsing fails
        }

        if (!currentState) {
            currentState = {
                interpretation: '',
                tags: [],
                status: 'pending_analysis',
                lastUpdate: Date.now()
            };
        }

        if (chunk.content) {
            currentState.interpretation += chunk.content;
        }
        if (chunk.tags) {
            currentState.tags = chunk.tags;
        }
        if (chunk.status) {
            currentState.status = chunk.status;
        }
        currentState.lastUpdate = Date.now();

        if (isFinal && chunk.finalStatus) {
            currentState.status = chunk.finalStatus;
        }

        await this.redis.setex(key, REDIS_EXPIRATION_SECONDS, JSON.stringify(currentState));
    }

    /**
     * Retrieves the current analysis state from Redis.
     * @param dreamId The ID of the dream.
     * @returns The analysis state or null if not found.
     */
    async getAnalysis(dreamId: string): Promise<AnalysisState | null> {
        const key = this.getKey(dreamId);
        const rawState = await this.redis.get(key);
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
     * Checks if an analysis is currently being processed.
     * @param dreamId The ID of the dream.
     * @returns True if analysis is ongoing, false otherwise.
     */
    async isAnalysisOngoing(dreamId: string): Promise<boolean> {
        const key = this.getKey(dreamId);
        const state = await this.getAnalysis(dreamId);
        return state?.status === 'pending_analysis' || false;
    }

    /**
     * Marks an analysis as started.
     * @param dreamId The ID of the dream.
     */
    async markAnalysisStarted(dreamId: string): Promise<void> {
        const key = this.getKey(dreamId);
        const initialState: AnalysisState = {
            interpretation: '',
            tags: [],
            status: 'pending_analysis',
            lastUpdate: Date.now()
        };
        // Set with a short expiration to prevent stale locks if process crashes
        await this.redis.setex(key, REDIS_EXPIRATION_SECONDS, JSON.stringify(initialState));
    }

    /**
     * Cleans up the analysis state from Redis (e.g., after completion or failure).
     * @param dreamId The ID of the dream.
     */
    async clearAnalysis(dreamId: string): Promise<void> {
        const key = this.getKey(dreamId);
        const channel = this.getChannel(dreamId);
        await this.redis.del(key);
        // Optionally publish a final message to the channel before clearing
        await this.redis.publish(channel, JSON.stringify({ finalStatus: 'cleared' }));
    }

    /**
     * Publishes an analysis update to a Redis Pub/Sub channel.
     * @param dreamId The ID of the dream.
     * @param chunk The analysis chunk to publish.
     */
    async publishUpdate(dreamId: string, chunk: AnalysisStreamChunk): Promise<void> {
        const channel = this.getChannel(dreamId);
        await this.redis.publish(channel, JSON.stringify(chunk));
    }

    /**
     * Subscribes to analysis updates for a specific dream.
     * @param dreamId The ID of the dream.
     * @param callback Function to call when an update is received.
     * @returns A Redis client instance that is subscribed.
     */
    subscribeToUpdates(dreamId: string, callback: (message: AnalysisStreamChunk) => void): Redis {
        const subscriber = getRedisClient().duplicate(); // Use a duplicate client for subscribing
        const channel = this.getChannel(dreamId);

        subscriber.subscribe(channel, (err) => {
            if (err) {
                console.error(`Failed to subscribe to Redis channel ${channel}:`, err);
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

        subscriber.on('error', (err) => {
            console.error(`Redis subscriber error for ${dreamId}:`, err);
        });

        return subscriber;
    }

    /**
     * Unsubscribes and quits a Redis subscriber client.
     * @param subscriber The Redis client instance to unsubscribe.
     * @param dreamId The ID of the dream.
     */
    async unsubscribeFromUpdates(subscriber: Redis, dreamId: string): Promise<void> {
        const channel = this.getChannel(dreamId);
        try {
            await subscriber.unsubscribe(channel);
            await subscriber.quit();
            console.log(`Unsubscribed from Redis channel: ${channel} and quit client.`);
        } catch (e) {
            console.error(`Error unsubscribing/quitting Redis client for ${dreamId}:`, e);
        }
    }
}

export const analysisStore = new AnalysisStore();
