import { createTRPCClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '$server/trpc/router';

/** Browser-side tRPC transport. Credentials ride along on the Better Auth session cookie. */
export function makeTrpcClient(fetchImpl?: typeof fetch) {
	return createTRPCClient<AppRouter>({
		links: [
			httpBatchLink({
				url: '/api/trpc',
				transformer: superjson,
				fetch: fetchImpl,
				maxURLLength: 1800
			})
		]
	});
}

export type TrpcClient = ReturnType<typeof makeTrpcClient>;
