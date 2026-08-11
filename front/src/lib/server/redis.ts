import Redis from 'ioredis';
import { config } from '$lib/server/config/env';

let redis: Redis | null = null; // Initialize as null

export function getRedisClient(): Redis {
	// Removed async
	if (!redis) {
		redis = new Redis(config.redis.url);

		redis.on('connect', () => {
			console.log('Connected to Redis');
		});

		redis.on('error', (err) => {
			console.error('Redis error:', err);
		});
	}
	return redis;
}

// Optional: Function to close the Redis connection gracefully
export async function closeRedisClient(): Promise<void> {
	if (redis) {
		await redis.quit();
		redis = null; // Clear the instance
		console.log('Redis connection closed.');
	}
}
