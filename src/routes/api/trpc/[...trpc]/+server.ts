import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { readSession } from '$server/auth';
import { logger } from '$server/logger';
import { appRouter } from '$server/trpc/router';
import type { RequestHandler } from './$types';

/**
 * tRPC over HTTP. The context is always built server-side from the Better Auth
 * session — a client can never assert an identity.
 */
export const GET: RequestHandler = handler;
export const POST: RequestHandler = handler;

async function handler(event: Parameters<RequestHandler>[0]) {
	let clientKey = 'anon';
	try {
		clientKey = event.getClientAddress();
	} catch {
		clientKey = `req-${crypto.randomUUID().slice(0, 8)}`;
	}

	return fetchRequestHandler({
		endpoint: '/api/trpc',
		router: appRouter,
		req: event.request,
		createContext: async ({ req }) => {
			const headers = new Headers(req.headers);
			const session = await readSession(headers);
			return { user: session?.user ?? null, headers, clientKey };
		},
		onError: ({ error }) => {
			if (error.code !== 'UNAUTHORIZED') logger.warn('trpc_error', { code: error.code, message: error.message });
		}
	});
}
