import { defineConfig } from 'drizzle-kit';

try {
	process.loadEnvFile?.();
} catch {
	// rely on the real environment
}
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

export default defineConfig({
	schema: './src/lib/server/db/schema/index.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: { url },
	strict: true,
	verbose: true
});
