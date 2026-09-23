import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db';
import { accounts, sessions, users, verifications } from './db/schema/auth';
import { env } from './env';
import { logger } from './logger';

export type AuthUser = { id: string; name: string; email: string; image?: string | null };
export type AuthSession = { id: string; userId: string; expiresAt: Date; token: string };

export const auth = betterAuth({
	appName: 'SkillOS',
	baseURL: env().PUBLIC_APP_URL,
	secret: env().BETTER_AUTH_SECRET,
	trustedOrigins: [env().PUBLIC_APP_URL, 'http://localhost:5173'],
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema: { user: users, session: sessions, account: accounts, verification: verifications }
	}),
	emailAndPassword: {
		enabled: true,
		minPasswordLength: 8,
		maxPasswordLength: 128,
		autoSignIn: true
	},
	session: {
		expiresIn: 60 * 60 * 24 * 30,
		updateAge: 60 * 60 * 24,
		cookieCache: { enabled: true, maxAge: 60 * 5 }
	},
	advanced: {
		database: { generateId: () => crypto.randomUUID() },
		defaultCookieAttributes: { sameSite: 'lax', httpOnly: true, secure: env().NODE_ENV === 'production' }
	}
});

/** Reads the Better Auth session, tolerating a cold or unavailable database. */
export async function readSession(headers: Headers): Promise<{ user: AuthUser; session: AuthSession } | null> {
	try {
		const result = await auth.api.getSession({ headers });
		if (!result?.user) return null;
		return {
			user: { id: result.user.id, name: result.user.name, email: result.user.email, image: result.user.image ?? null },
			session: {
				id: result.session.id,
				userId: result.session.userId,
				expiresAt: new Date(result.session.expiresAt),
				token: result.session.token
			}
		};
	} catch (err) {
		logger.warn('auth.session_read_failed', { reason: err instanceof Error ? err.message : String(err) });
		return null;
	}
}
