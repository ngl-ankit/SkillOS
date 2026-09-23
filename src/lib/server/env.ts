import { z } from 'zod';

/**
 * Server-only environment. Reads process.env so the module works in SvelteKit
 * (dev + adapter-node), scripts, Vitest and Trigger.dev workers alike.
 */
if (!process.env.DATABASE_URL) {
	try {
		process.loadEnvFile?.();
	} catch {
		// No .env file — rely on the real environment.
	}
}

const schema = z.object({
	NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
	DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
	BETTER_AUTH_SECRET: z.string().min(16, 'BETTER_AUTH_SECRET must be at least 16 characters'),
	XAI_API_KEY: z.string().optional().default(''),
	XAI_MODEL: z.string().optional().default(''),
	PUBLIC_APP_URL: z.string().optional().default('http://localhost:5173'),
	TRIGGER_SECRET_KEY: z.string().optional().default('')
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | null = null;

export function env(): ServerEnv {
	if (cached) return cached;
	const parsed = schema.safeParse(process.env);
	if (!parsed.success) {
		// Vite/SvelteKit build-time analysis imports server modules without runtime
		// env. Placeholders keep the build honest; the real server never starts on
		// them because the migrate script and first DB touch fail fast.
		if (process.env.SKILLOS_BUILD === '1') {
			cached = {
				NODE_ENV: 'production',
				DATABASE_URL: 'postgres://placeholder:placeholder@127.0.0.1:5432/placeholder',
				BETTER_AUTH_SECRET: 'build-time-placeholder-secret-0123456789',
				XAI_API_KEY: '',
				XAI_MODEL: '',
				PUBLIC_APP_URL: 'http://localhost:5173',
				TRIGGER_SECRET_KEY: ''
			};
			return cached;
		}
		const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
		throw new Error(`Invalid server environment — ${issues}`);
	}
	cached = { ...parsed.data, PUBLIC_APP_URL: parsed.data.PUBLIC_APP_URL.replace(/\/$/, '') };
	return cached;
}

export const DEFAULT_XAI_MODEL = 'grok-4.7';

export function aiConfigured(): boolean {
	return env().XAI_API_KEY.length > 0;
}

export function triggerConfigured(): boolean {
	return env().TRIGGER_SECRET_KEY.length > 0;
}
