import type { AuthSession, AuthUser } from '$server/auth';

declare global {
	namespace App {
		interface Error {
			message: string;
			code?: string;
		}
		interface Locals {
			user: AuthUser | null;
			session: AuthSession | null;
		}
		interface PageData {
			user?: AuthUser | null;
		}
	}
}
