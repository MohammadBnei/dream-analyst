import { request, type FullConfig } from '@playwright/test';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

async function globalTeardown(config: FullConfig) {
	const { baseURL } = config.projects[0].use;

	if (!baseURL) {
		throw new Error('baseURL is not configured in playwright.config.ts');
	}

	// Create a request context
	const apiContext = await request.newContext({
		baseURL
	});

	// Make a request to the logout endpoint
	const response = await apiContext.post('/logout');

	if (!response.ok()) {
		console.error('Failed to log out during global teardown:', await response.text());
	} else {
		console.log('Successfully logged out during global teardown.');
	}

	// Dispose the request context
	await apiContext.dispose();
}

export default globalTeardown;
