import { expect, test } from '@playwright/test';

test('landing page renders and links to auth', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toContainText(/executing a plan|learning/i);
	await expect(page.getByRole('link', { name: /get started/i })).toBeVisible();
});

test('health endpoint responds', async ({ request }) => {
	const response = await request.get('/api/health');
	expect(response.ok()).toBeTruthy();
	const body = await response.json();
	expect(body.status).toBe('ok');
});

test('protected app redirects to auth', async ({ page }) => {
	await page.goto('/app');
	await expect(page).toHaveURL(/\/auth/);
});

test('auth page supports sign in and sign up modes', async ({ page }) => {
	await page.goto('/auth');
	await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
	await page.getByRole('button', { name: /create an account/i }).click();
	await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
});
