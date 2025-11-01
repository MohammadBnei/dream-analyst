import { chromium, expect, type FullConfig } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Get __dirname equivalent in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function globalSetup(config: FullConfig) {
	const { baseURL, storageState } = config.projects[0].use;

	if (!baseURL) {
		throw new Error('baseURL is not configured in playwright.config.ts');
	}

	// Create a new browser context for authentication
	const browser = await chromium.launch();
	const page = await browser.newPage();

	// Navigate to the login page
	await page.goto(`${baseURL}/login`);

	// Fill in the login form
	await page.fill('input[name="email"]', process.env.E2E_TEST_USERNAME || 'test@example.com');
	await page.fill('input[name="password"]', process.env.E2E_TEST_PASSWORD || 'password');

	// Click the login button
	await page.click('button[type="submit"]');

	// Wait for navigation to complete and verify successful login
	await page.waitForURL(`${baseURL}/dreams`);
	await expect(page.locator('h1')).toHaveText('My Dreams');

	// Save the authentication state
	await page.context().storageState({ path: storageState as string });

	await browser.close();
}

export default globalSetup;
