import { test, expect } from '@playwright/test';

/**
 * These assert the app's ACTUAL behaviour. The previous version expected
 * registration to redirect to /login and showed English headings; registration
 * signs you in and redirects to /, and the default locale is French. It also
 * never ran - see the note in playwright.config.ts.
 */

const unique = () => Math.random().toString(36).slice(2, 10);

test.describe('Authentication', () => {
	test('registers a new user and signs them in', async ({ page }) => {
		const id = unique();

		await page.goto('/register');
		await expect(page.locator('h1')).toBeVisible();

		await page.fill('input[name="username"]', `user_${id}`);
		await page.fill('input[name="email"]', `user_${id}@example.test`);
		await page.fill('input[name="password"]', 'password123');
		await page.fill('input[name="passwordConfirm"]', 'password123');
		await page.locator('form').first().locator('button[type="submit"]').click();

		// Registration establishes a session and lands on the home page.
		await page.waitForURL('/');

		// The session is real: a protected route no longer bounces to /login.
		await page.goto('/dreams');
		await expect(page).toHaveURL(/\/dreams$/);
	});

	test('rejects invalid credentials', async ({ page }) => {
		await page.goto('/login');
		await page.fill('input[name="identity"]', `nobody_${unique()}@example.test`);
		await page.fill('input[name="password"]', 'wrongpassword');
		await page.locator('form').first().locator('button[type="submit"]').click();

		await expect(page).toHaveURL(/\/login/);
		await expect(page.locator('.alert-error')).toBeVisible();
	});

	test('rejects an empty registration form', async ({ page }) => {
		await page.goto('/register');
		// Bypass the browser's own required-field blocking so the server responds.
		await page
			.locator('form')
			.first()
			.evaluate((f: HTMLFormElement) => (f.noValidate = true));
		await page.locator('form').first().locator('button[type="submit"]').click();

		await expect(page).toHaveURL(/\/register/);
		await expect(page.locator('.alert-error')).toBeVisible();
	});

	test('rejects mismatched passwords', async ({ page }) => {
		const id = unique();
		await page.goto('/register');
		await page.fill('input[name="username"]', `mismatch_${id}`);
		await page.fill('input[name="email"]', `mismatch_${id}@example.test`);
		await page.fill('input[name="password"]', 'password123');
		await page.fill('input[name="passwordConfirm"]', 'differentpassword');
		await page.locator('form').first().locator('button[type="submit"]').click();

		await expect(page).toHaveURL(/\/register/);
		await expect(page.locator('.alert-error')).toBeVisible();
	});
});

test.describe('Route guards', () => {
	for (const path of ['/dreams', '/dreams/new', '/profile', '/admin']) {
		test(`${path} redirects an anonymous visitor to login`, async ({ page }) => {
			await page.goto(path);
			await expect(page).toHaveURL(/\/login/);
		});
	}

	test('a protected API answers 401 rather than redirecting', async ({ request }) => {
		const res = await request.get('/api/dreams/does-not-exist/stream-analysis');
		expect(res.status()).toBe(401);
	});
});
