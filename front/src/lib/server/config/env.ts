import { env } from '$env/dynamic/private';

/**
 * Validates that all required environment variables are present.
 * Should be called at application startup to fail fast if configuration is missing.
 *
 * @throws Error if any required environment variables are missing
 */
export function validateEnvironment() {
	const required = ['DATABASE_URL', 'OPENROUTER_API_KEY', 'REDIS_URL', 'JWT_SECRET'];

	const missing = required.filter((key) => !env[key]);

	if (missing.length > 0) {
		throw new Error(
			`Missing required environment variables: ${missing.join(', ')}\n` +
				`Please check your .env file and ensure all required variables are set.`
		);
	}
}

/**
 * Centralized application configuration.
 * All configuration values should be accessed through this object.
 */
export const config = {
	database: {
		url: env.DATABASE_URL!
	},
	llm: {
		apiKey: env.OPENROUTER_API_KEY!,
		model: env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
		modelName: env.OPENROUTER_MODEL_NAME || 'mistralai/mistral-7b-instruct-v0.2'
	},
	redis: {
		url: env.REDIS_URL!,
		streamExpiration: parseInt(env.REDIS_STREAM_EXPIRATION || '180', 10),
		stallThreshold: parseInt(env.REDIS_STALL_THRESHOLD || '15', 10)
	},
	auth: {
		jwtSecret: env.JWT_SECRET!,
		jwtExpiry: env.JWT_EXPIRY || '30d',
		saltRounds: parseInt(env.BCRYPT_SALT_ROUNDS || '10', 10)
	},
	credits: {
		dreamAnalysis: parseInt(env.CREDIT_COST_DREAM_ANALYSIS || '2', 10),
		chatMessage: parseInt(env.CREDIT_COST_CHAT_MESSAGE || '1', 10),
		dailyLimit: parseInt(env.DAILY_CREDIT_LIMIT || '100', 10)
	},
	app: {
		origin: env.ORIGIN,
		siteUrl: env.ORIGIN, // For OpenRouter rankings
		nodeEnv: env.NODE_ENV || 'development'
	},
	n8n: {
		webhookUrl: env.N8N_WEBHOOK_URL
	}
};
