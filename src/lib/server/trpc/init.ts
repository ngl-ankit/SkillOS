import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { AppError } from '$server/errors';

export type AuthedUser = { id: string; name: string; email: string };

export type Context = {
	user: AuthedUser | null;
	headers: Headers;
	clientKey: string;
};

export function createContextFactory() {
	const t = initTRPC.context<Context>().create({
		transformer: superjson,
		errorFormatter({ shape, error }) {
			const cause = error.cause;
			let code = shape.data.code as string;
			if (cause instanceof AppError) code = cause.code;
			return {
				...shape,
				data: { ...shape.data, code, appMessage: cause instanceof AppError ? cause.message : undefined }
			};
		}
	});

	const mapError = (err: unknown): never => {
		if (err instanceof AppError) {
			const map: Record<string, TRPCError['code']> = {
				NOT_FOUND: 'NOT_FOUND',
				FORBIDDEN: 'FORBIDDEN',
				BAD_REQUEST: 'BAD_REQUEST',
				CONFLICT: 'CONFLICT',
				PRECONDITION_FAILED: 'PRECONDITION_FAILED',
				TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS'
			};
			throw new TRPCError({ code: map[err.code] ?? 'INTERNAL_SERVER_ERROR', message: err.message, cause: err });
		}
		if (err instanceof ZodError) {
			throw new TRPCError({ code: 'BAD_REQUEST', message: err.issues[0]?.message ?? 'Invalid input', cause: err });
		}
		throw err;
	};

	const middleware = t.middleware(async ({ ctx, next }) => {
		try {
			return await next({ ctx });
		} catch (err) {
			return mapError(err);
		}
	});

	const requireAuth = t.middleware(async ({ ctx, next }) => {
		if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Sign in to continue' });
		return next({ ctx: { ...ctx, user: ctx.user } });
	});

	return {
		t,
		router: t.router,
		/** Public procedure: never trusts a client-supplied user id. */
		publicProcedure: t.procedure.use(middleware),
		/** Protected procedure: identity always comes from the server session. */
		protectedProcedure: t.procedure.use(middleware).use(requireAuth)
	};
}

export type { TRPCError };
