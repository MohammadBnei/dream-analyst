import Redis from 'ioredis';
import { env } from '$env/dynamic/private';

let redis: Redis | null = null; // Initialize as null

export function getRedisClient(): Redis {
	// Removed async
	if (!redis) {
		if (!env.REDIS_URL) {
			// This error will now be thrown synchronously if REDIS_URL is missing
			// during any import/instantiation of this module.
			throw new Error('REDIS_URL is not defined');
		}
		redis = new Redis(env.REDIS_URL);

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
