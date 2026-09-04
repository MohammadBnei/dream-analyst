import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Read from default ".env" file.
dotenv.config();

/**
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
	testDir: './tests',
	/* tests/integration and tests/setup are bun test files - they import bun:test,
	   which Node's ESM loader cannot resolve. Playwright's default testMatch picks
	   up *.test.ts, so they have to be excluded explicitly. */
	testIgnore: ['**/integration/**', '**/setup/**'],
	/* Run tests in files in parallel */
	fullyParallel: true,
	/* Fail the build on CI if you accidentally left test.only in the source code. */
	forbidOnly: !!process.env.CI,
	/* Retry on CI only */
	retries: process.env.CI ? 2 : 0,
	/* Opt out of parallel tests on CI. */
	workers: process.env.CI ? 1 : undefined,
	/* Reporter to use. See https://playwright.dev/docs/test-reporters */
	reporter: [['html', { outputFolder: 'playwright/report' }]],

	/* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
	use: {
		/* Base URL to use in actions like `await page.goto('/')`. */
		baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:4173',

		/* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
		trace: 'on-first-retry'

		// NO global storageState. It used to point at
		// 'playwright/.auth/storageState.json', a file that was never written -
		// global.setup.ts exported a default function (the old globalSetup API)
		// while being registered as a PROJECT, so it never executed. Every project
		// then failed on the missing file, which is why this suite had never run.
		// The specs here test signed-out flows and sign in themselves; add a
		// storageState fixture when a spec actually needs a pre-authenticated
		// session.
	},

	/* Starts the app if one is not already listening, so `bun run e2e` works from
	   a clean checkout instead of requiring a manually started preview server. */
	webServer: {
		command: 'bun run dev --port 4173',
		url: 'http://localhost:4173',
		reuseExistingServer: !process.env.CI,
		timeout: 120_000
	},

	/* Configure projects for major browsers */
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		},
		{
			name: 'Mobile Chrome',
			use: { ...devices['Pixel 5'] }
		}
		// firefox and webkit are omitted deliberately: they triple the run time and
		// this suite exercises server behaviour, not rendering differences. Add them
		// back when there is a rendering bug worth guarding against.
		// {
		//   name: 'Mobile Safari',
		//   use: { ...devices['iPhone 12'] },
		// },

		/* Test against branded browsers. */
		// {
		//   name: 'Microsoft Edge',
		//   use: { ...devices['Desktop Edge'], channel: 'msedge' },
		// },
		// {
		//   name: 'Google Chrome',
		//   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
		// },
	]
});
