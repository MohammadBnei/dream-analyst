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

let redis: Redis | null = null;

export function getRedisClient(): Redis { // Removed async
    if (!redis) {
        if (!env.REDIS_URL) {
            // This error will now be thrown synchronously if REDIS_URL is missing
            // during any import/instantiation of this module.
            throw new Error('REDIS_URL is not defined');
        }
        redis = new Redis(env.REDIS_URL);

        redis.on('connect', () => {
            console.log('Redis client connected.');
        });

        redis.on('error', (err) => {
            console.error('Redis client error:', err);
        });
    }
    return redis;
}

export async function closeRedisClient(): Promise<void> {
    if (redis) {
        await redis.quit();
        redis = null; // Clear the instance
        console.log('Redis connection closed.');
    }
}

class AnalysisStore {
    private redis: Redis; // Directly store the Redis client

    constructor() {
        // Directly get the Redis client. This will throw if REDIS_URL is not defined
        // at the time this constructor runs.
        this.redis = getRedisClient();
    }

    private getKey(dreamId: string): string {
        return `${REDIS_PREFIX}${dreamId}`;
    }

    private getChannel(dreamId: string): string {
        return `${REDIS_PREFIX}channel:${dreamId}`;
    }

    async updateAnalysis(dreamId: string, chunk: AnalysisStreamChunk, isFinal: boolean = false, refreshExpiration: boolean = true): Promise<void> {
        const key = this.getKey(dreamId);
        let currentState: AnalysisState | null = null;

        try {
            const rawState = await this.redis.get(key); // Use this.redis directly
            if (rawState) {
                currentState = JSON.parse(rawState);
            }
        } catch (e) {
            console.error(`Failed to parse existing Redis state for ${dreamId}:`, e);
            // If parsing fails, start with a fresh state to avoid blocking
            currentState = null;
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

        if (isFinal) {
            // For final state, set with expiration, but it will be cleared soon by clearAnalysis
            await this.redis.setex(key, REDIS_EXPIRATION_SECONDS, serializedState);
        } else if (refreshExpiration) {
            // For intermediate updates, refresh expiration
            await this.redis.setex(key, REDIS_EXPIRATION_SECONDS, serializedState);
        } else {
            // If not refreshing expiration, just set the value
            await this.redis.set(key, serializedState);
        }
    }

    async getAnalysis(dreamId: string): Promise<AnalysisState | null> {
        const key = this.getKey(dreamId);
        const rawState = await this.redis.get(key); // Use this.redis directly
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

    async isAnalysisOngoing(dreamId: string): Promise<boolean> {
        const state = await this.getAnalysis(dreamId);
        if (state?.status === DreamStatus.PENDING_ANALYSIS) {
            const now = Date.now();
            // If the last update is too old, consider it stalled
            if ((now - state.lastUpdate) / 1000 > REDIS_STALL_THRESHOLD_SECONDS) {
                console.warn(`Dream ${dreamId}: Detected stalled analysis (last update ${state.lastUpdate}). Clearing state.`);
                await this.clearAnalysis(dreamId); // Clear the stalled state
                return false; // Not truly ongoing
            }
            return true; // Ongoing and not stalled
        }
        return false; // Not pending or no state found
    }

    async markAnalysisStarted(dreamId: string): Promise<void> {
        const key = this.getKey(dreamId);
        const initialState: AnalysisState = {
            interpretation: '',
            tags: [],
            status: DreamStatus.PENDING_ANALYSIS,
            lastUpdate: Date.now()
        };
        // Set with initial expiration
        await this.redis.setex(key, REDIS_EXPIRATION_SECONDS, JSON.stringify(initialState)); // Use this.redis directly
    }

    async clearAnalysis(dreamId: string): Promise<void> {
        const key = this.getKey(dreamId);
        const channel = this.getChannel(dreamId);
        await this.redis.del(key); // Use this.redis directly
        // Publish a final message to the channel before clearing
        // This ensures any lingering subscribers get a final status
        await this.redis.publish(channel, JSON.stringify({ finalStatus: DreamStatus.COMPLETED, message: 'Analysis state cleared from Redis.' }));
        console.log(`Dream ${dreamId}: Analysis state cleared from Redis.`);
    }

    async publishUpdate(dreamId: string, chunk: AnalysisStreamChunk): Promise<void> {
        const channel = this.getChannel(dreamId);
        // Ensure chunk is always stringified JSON
        await this.redis.publish(channel, JSON.stringify(chunk)); // Use this.redis directly
    }

    subscribeToUpdates(dreamId: string, callback: (message: AnalysisStreamChunk) => void): Redis {
        const subscriber = this.redis.duplicate(); // Use getRedisClient directly
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
                    // Parse the message as JSON before passing to callback
                    const parsedMessage: AnalysisStreamChunk = JSON.parse(message);
                    callback(parsedMessage);
                } catch (e) {
                    console.error(`Failed to parse Pub/Sub message for ${dreamId}:`, e);
                }
            }
        });

        return subscriber;
    }

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

let analysisStoreInstance: AnalysisStore;

export async function getAnalysisStore(): Promise<AnalysisStore> {
    if (!analysisStoreInstance) {
        analysisStoreInstance = new AnalysisStore();
    }
    return analysisStoreInstance;
}
