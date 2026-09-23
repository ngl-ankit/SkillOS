export type AppErrorCode = 'NOT_FOUND' | 'FORBIDDEN' | 'BAD_REQUEST' | 'CONFLICT' | 'PRECONDITION_FAILED' | 'TOO_MANY_REQUESTS';

/** Domain error with a user-safe message. Mapped to tRPC / HTTP codes at the edge. */
export class AppError extends Error {
	constructor(
		public readonly code: AppErrorCode,
		message: string
	) {
		super(message);
		this.name = 'AppError';
	}
}

export const notFound = (what = 'Resource') => new AppError('NOT_FOUND', `${what} not found`);
export const badRequest = (message: string) => new AppError('BAD_REQUEST', message);
export const precondition = (message: string) => new AppError('PRECONDITION_FAILED', message);
