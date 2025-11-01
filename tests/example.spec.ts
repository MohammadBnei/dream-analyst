import { test, expect } from '@playwright/test';

test.describe('Dream Journal Application', () => {
	test('should navigate to the dreams page and display dreams', async ({ page }) => {
		await page.goto('/dreams');

		// Expect a title "to contain" a substring.
		await expect(page).toHaveTitle(/Dream Journal/);

		// Expect to see the main heading for dreams
		await expect(page.locator('h1')).toHaveText('My Dreams');

		// Expect to see a link to create a new dream
		await expect(page.getByRole('link', { name: 'New Dream' })).toBeVisible();
	});

	test('should navigate to the about page', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('link', { name: 'About' }).click();
		await expect(page).toHaveURL(/about/);
		await expect(page.locator('h1')).toHaveText('About This App');
	});

	test('should navigate to the settings page', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('link', { name: 'Settings' }).click();
		await expect(page).toHaveURL(/settings/);
		await expect(page.locator('h1')).toHaveText('Settings');
	});
});
