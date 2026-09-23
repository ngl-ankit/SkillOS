import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4173);

export default defineConfig({
	testDir: 'tests/e2e',
	timeout: 45_000,
	expect: { timeout: 10_000 },
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: 1,
	reporter: [['list']],
	use: {
		baseURL: `http://127.0.0.1:${PORT}`,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		viewport: { width: 1440, height: 900 }
	},
	projects: [
		{ name: 'desktop', use: { ...devices['Desktop Chrome'] } },
		{ name: 'mobile', use: { ...devices['Pixel 7'] } }
	],
	webServer: {
		command: `bun run build && PORT=${PORT} ORIGIN=http://127.0.0.1:${PORT} bun ./build/index.js`,
		port: PORT,
		reuseExistingServer: !process.env.CI,
		timeout: 180_000,
		env: { DATABASE_URL: process.env.DATABASE_URL ?? '', BETTER_AUTH_SECRET: 'e2e-secret-0123456789abcdef', PUBLIC_APP_URL: `http://127.0.0.1:${PORT}` }
	}
});
