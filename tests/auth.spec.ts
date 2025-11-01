import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

test.describe('Authentication Flows', () => {
	const testUsername = `testuser_${uuidv4().slice(0, 8)}`;
	const testEmail = `test_${uuidv4().slice(0, 8)}@example.com`;
	const testPassword = 'password123';

	test('should allow a new user to register and then log in', async ({ page }) => {
		// 1. Navigate to registration page
		await page.goto('/register');
		await expect(page).toHaveURL(/register/);
		await expect(page.locator('h1')).toHaveText('Register');

		// 2. Fill out registration form
		await page.fill('input[name="username"]', testUsername);
		await page.fill('input[name="email"]', testEmail);
		await page.fill('input[name="password"]', testPassword);
		await page.fill('input[name="passwordConfirm"]', testPassword);

		// 3. Submit registration form
		await page.click('button[type="submit"]');

		// 4. Expect redirection to login page after successful registration
		await page.waitForURL(/login/);
		await expect(page.locator('h1')).toHaveText('Login');
		await expect(page.locator('.alert-success')).toContainText('Registration successful! Please log in.');

		// 5. Log in with the newly registered user
		await page.fill('input[name="identity"]', testEmail);
		await page.fill('input[name="password"]', testPassword);
		await page.click('button[type="submit"]');

		// 6. Expect redirection to dreams page after successful login
		await page.waitForURL(/dreams/);
		await expect(page.locator('h1')).toHaveText('My Dreams');
	});

	test('should display an error for invalid login credentials', async ({ page }) => {
		await page.goto('/login');
		await expect(page).toHaveURL(/login/);

		// Fill with invalid credentials
		await page.fill('input[name="identity"]', 'nonexistent@example.com');
		await page.fill('input[name="password"]', 'wrongpassword');
		await page.click('button[type="submit"]');

		// Expect to stay on the login page and see an error message
		await expect(page).toHaveURL(/login/);
		await expect(page.locator('.alert-error')).toBeVisible();
		await expect(page.locator('.alert-error')).toContainText('Invalid credentials');
	});

	test('should display an error for missing registration fields', async ({ page }) => {
		await page.goto('/register');
		await expect(page).toHaveURL(/register/);

		// Submit an empty form
		await page.click('button[type="submit"]');

		// Expect to stay on the register page and see error messages (client-side validation might prevent submission, or server-side will return errors)
		// This assumes server-side validation returns a message. If client-side validation prevents submission,
		// you might need to check for HTML5 validation messages or specific error indicators.
		await expect(page).toHaveURL(/register/);
		await expect(page.locator('.alert-error')).toBeVisible(); // Assuming a general error message for missing fields
	});

	test('should display an error if passwords do not match during registration', async ({ page }) => {
		await page.goto('/register');
		await expect(page).toHaveURL(/register/);

		await page.fill('input[name="username"]', `mismatchuser_${uuidv4().slice(0, 8)}`);
		await page.fill('input[name="email"]', `mismatch_${uuidv4().slice(0, 8)}@example.com`);
		await page.fill('input[name="password"]', 'password123');
		await page.fill('input[name="passwordConfirm"]', 'differentpassword'); // Mismatched password

		await page.click('button[type="submit"]');

		await expect(page).toHaveURL(/register/);
		await expect(page.locator('.alert-error')).toBeVisible();
		await expect(page.locator('.alert-error')).toContainText('Passwords do not match');
	});
});
