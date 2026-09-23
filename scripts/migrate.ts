#!/usr/bin/env bun
/**
 * Applies the checked-in SQL migrations in drizzle/ to DATABASE_URL.
 *
 * Deliberately dependency-free of the app's path aliases so it can run as a
 * bare `bun` script — Render executes it as the pre-deploy command
 * (`bun run db:migrate`) before the web service starts.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
	console.error('[migrate] DATABASE_URL is not set — aborting.');
	process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
	await migrate(drizzle(sql), { migrationsFolder: 'drizzle' });
	console.log('[migrate] all migrations applied.');
} catch (error) {
	console.error('[migrate] migration failed:', error);
	process.exitCode = 1;
} finally {
	await sql.end({ timeout: 5 });
}
