import { createCallerFactory } from '@trpc/server';
import type { Context } from './init';
import { appRouter } from './router';

const createCaller = createCallerFactory(appRouter);

/**
 * Builds a server-side caller whose context comes from the authenticated
 * SvelteKit session — never from client input.
 */
export function createCallerFor(user: { id: string; name: string; email: string } | null, opts?: { clientKey?: string; headers?: Headers }): ReturnType<typeof createCaller> {
	const ctx: Context = {
		user,
		headers: opts?.headers ?? new Headers(),
		clientKey: opts?.clientKey ?? 'ssr'
	};
	return createCaller(ctx);
}

export type ServerCaller = ReturnType<typeof createCallerFor>;
