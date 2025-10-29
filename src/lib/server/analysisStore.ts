import { getRedisClient } from './redis';
import type { AnalysisStreamChunk } from './n8nService';
import Redis from 'ioredis'; // Import Redis for subscriber client
import { env } from '$env/dynamic/private'; // Import env to check for REDIS_URL

const REDIS_PREFIX = 'dream_analysis:';
const REDIS_EXPIRATION_SECONDS = 60 * 60 * 2; // Store analysis state for 2 hours (longer than expected analysis)
export const REDIS_HEARTBEAT_INTERVAL_SECONDS = 30; // How often the background process refreshes the key expiration
const REDIS_STALL_THRESHOLD_SECONDS = REDIS_HEARTBEAT_INTERVAL_SECONDS * 2; // If lastUpdate is older than this, consider stalled

interface AnalysisState {
    interpretation: string;
    tags: string[];
    status: 'pending_analysis' | 'completed' | 'analysis_failed';
    lastUpdate: number; // Timestamp of last update (milliseconds)
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

    /**
     * Initializes or updates the analysis state in Redis.
     * @param dreamId The ID of the dream.
     * @param chunk The analysis chunk containing updates.
     * @param isFinal If true, sets the final status and potentially clears the key.
     * @param refreshExpiration If true, refreshes the key's expiration time.
     */
    async updateAnalysis(dreamId: string, chunk: AnalysisStreamChunk, isFinal: boolean = false, refreshExpiration: boolean = false): Promise<void> {
        const key = this.getKey(dreamId);
        let currentState: AnalysisState | null = null;

        try {
            const rawState = await this.redis.get(key); // Use this.redis directly
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

        // Always refresh expiration if it's a final update or explicitly requested (heartbeat)
        if (isFinal || refreshExpiration) {
            await this.redis.setex(key, REDIS_EXPIRATION_SECONDS, JSON.stringify(currentState));
        } else {
            // Otherwise, just update the value without changing expiration
            await this.redis.set(key, JSON.stringify(currentState));
        }
    }

    /**
     * Retrieves the current analysis state from Redis.
     * @param dreamId The ID of the dream.
     * @returns The analysis state or null if not found.
     */
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

    /**
     * Checks if an analysis is currently being processed and is not stalled.
     * @param dreamId The ID of the dream.
     * @returns True if analysis is ongoing and active, false otherwise.
     */
    async isAnalysisOngoing(dreamId: string): Promise<boolean> {
        const state = await this.getAnalysis(dreamId);
        if (state?.status === 'pending_analysis') {
            const now = Date.now();
            // If the last update is too old, consider it stalled
            if ((now - state.lastUpdate) / 1000 > REDIS_STALL_THRESHOLD_SECONDS) {
                console.warn(`Dream ${dreamId}: Detected stalled analysis (last update ${state.lastUpdate}, now ${now}). Clearing Redis state.`);
                await this.clearAnalysis(dreamId); // Clear the stalled state
                return false; // Not truly ongoing
            }
            return true; // Ongoing and active
        }
        return false; // Not pending or no state
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
        // Set with initial expiration
        await this.redis.setex(key, REDIS_EXPIRATION_SECONDS, JSON.stringify(initialState)); // Use this.redis directly
    }

    /**
     * Cleans up the analysis state from Redis (e.g., after completion or failure).
     * @param dreamId The ID of the dream.
     */
    async clearAnalysis(dreamId: string): Promise<void> {
        const key = this.getKey(dreamId);
        const channel = this.getChannel(dreamId);
        await this.redis.del(key); // Use this.redis directly
        // Publish a final message to the channel before clearing
        await this.redis.publish(channel, JSON.stringify({ finalStatus: 'cleared' })); // Use this.redis directly
    }

    /**
     * Publishes an analysis update to a Redis Pub/Sub channel.
     * @param dreamId The ID of the dream.
     * @param chunk The analysis chunk to publish.
     */
    async publishUpdate(dreamId: string, chunk: AnalysisStreamChunk): Promise<void> {
        const channel = this.getChannel(dreamId);
        await this.redis.publish(channel, JSON.stringify(chunk)); // Use this.redis directly
    }

    /**
     * Subscribes to analysis updates for a specific dream.
     * @param dreamId The ID of the dream.
     * @param callback Function to call when an update is received.
     * @returns A Redis client instance that is subscribed.
     */
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

// Export the instance directly. This will cause the constructor to run
// when the module is imported, potentially leading to the REDIS_URL error
// if not properly handled in the build environment.
export const analysisStore = new AnalysisStore();
