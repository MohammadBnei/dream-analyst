import Redis from 'ioredis';
import { env } from '$env/dynamic/private';
import type { AnalysisStreamChunk } from '$lib/server/langchainService';
import { DreamStatus } from '@prisma/client';
import type { DreamPromptType } from '$lib/server/prompts/dreamAnalyst'; // Import DreamPromptType

const REDIS_PREFIX = 'stream_state:';
const REDIS_EXPIRATION_SECONDS = 60 * 3;
const REDIS_STALL_THRESHOLD_SECONDS = 15;

export enum StreamStatus {
    PENDING = 'PENDING',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    STALLED = 'STALLED',
}

interface StreamState {
    interpretation: string;
    tags: string[];
    status: StreamStatus;
    lastUpdate: number;
    finalMessage?: string;
    promptType?: DreamPromptType; // Added promptType to StreamState
}

let publisherClient: Redis | null = null;

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

export async function closeRedisPublisher(): Promise<void> {
    if (publisherClient) {
        await publisherClient.quit();
        publisherClient = null;
        console.log('Redis publisher connection closed.');
    }
}

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
            currentState = null;
        }

        if (!currentState) {
            currentState = {
                interpretation: '',
                tags: [],
                status: StreamStatus.PENDING,
                lastUpdate: Date.now()
            };
        }

        if (chunk.content) {
            currentState.interpretation += chunk.content;
        }
        if (chunk.tags && chunk.tags.length > 0) {
            currentState.tags = chunk.tags;
        }

        if (chunk.status) {
            currentState.status = this.mapDreamStatusToStreamStatus(chunk.status);
        }
        if (chunk.finalStatus) {
            currentState.status = chunk.finalStatus === 'COMPLETED' ? StreamStatus.COMPLETED : StreamStatus.FAILED;
            currentState.finalMessage = chunk.message;
        } else if (isFinal && !chunk.status && !chunk.finalStatus) {
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

    async isStreamOngoing(streamId: string): Promise<boolean> {
        const state = await this.getStreamState(streamId);
        if (state && (state.status === StreamStatus.PENDING || state.status === StreamStatus.IN_PROGRESS)) {
            const now = Date.now();
            console.log({ state, last: (now - state.lastUpdate) / 1000, REDIS_STALL_THRESHOLD_SECONDS })
            if ((now - state.lastUpdate) / 1000 > REDIS_STALL_THRESHOLD_SECONDS) {
                console.warn(`Stream ${streamId}: Detected stalled stream (last update ${state.lastUpdate}). Marking as FAILED and clearing state.`);
                await this.updateStreamState(streamId, {
                    finalStatus: 'ANALYSIS_FAILED',
                    message: 'Stream stalled and automatically cleared.'
                }, true);
                await this.publishUpdate(streamId, {
                    finalStatus: 'ANALYSIS_FAILED',
                    message: 'Stream stalled and automatically cleared.'
                });
                await this.clearStreamState(streamId);
                return false;
            }
            return true;
        }
        return false;
    }

    async markStreamStarted(streamId: string, promptType: DreamPromptType): Promise<void> { // Added promptType parameter
        const key = this.getKey(streamId);
        const initialState: StreamState = {
            interpretation: '',
            tags: [],
            status: StreamStatus.PENDING,
            lastUpdate: Date.now(),
            promptType: promptType // Store the prompt type
        };
        await this.publisher.setex(key, REDIS_EXPIRATION_SECONDS, JSON.stringify(initialState));
    }

    async clearStreamState(streamId: string): Promise<void> {
        const key = this.getKey(streamId);
        await this.publisher.del(key);
        console.log(`Stream ${streamId}: Stream state cleared from Redis.`);
    }

    async publishUpdate(streamId: string, chunk: AnalysisStreamChunk): Promise<void> {
        const channel = this.getChannel(streamId);
        await this.publisher.publish(channel, JSON.stringify(chunk));
    }

    subscribeToUpdates(streamId: string, callback: (message: AnalysisStreamChunk) => void): AisRedis {
        const subscriber = getRedisSubscriber();
        const channel = this.getChannel(streamId);

        subscriber.subscribe(channel, (err) => {
            if (err) {
                console.error(`Failed to subscribe to Redis channel ${channel}:`, err);
                subscriber.quit();
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

    async unsubscribeFromUpdates(subscriber: AisRedis, streamId: string): Promise<void> {
        const channel = this.getChannel(streamId);
        try {
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

    private mapDreamStatusToStreamStatus(dreamStatus: DreamStatus): StreamStatus {
        switch (dreamStatus) {
            case DreamStatus.PENDING_ANALYSIS:
                return StreamStatus.PENDING;
            case DreamStatus.COMPLETED:
                return StreamStatus.COMPLETED;
            case DreamStatus.ANALYSIS_FAILED:
                return StreamStatus.FAILED;
            default:
                return StreamStatus.PENDING; // Default or throw error for unhandled
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
