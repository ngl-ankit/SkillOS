import type { Handle, HandleServerError } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { readSession } from '$server/auth';
import { logger } from '$server/logger';

const attachSession: Handle = async ({ event, resolve }) => {
	const result = await readSession(event.request.headers);
	event.locals.user = result?.user ?? null;
	event.locals.session = result?.session ?? null;
	return resolve(event, {
		transformPageChunk: ({ html }) => html
	});
};

const securityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
	if (event.url.protocol === 'https:') response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	return response;
};

export const handle = sequence(attachSession, securityHeaders);

export const handleError: HandleServerError = ({ error, status, message }) => {
	logger.error('request_failed', error, { status });
	return {
		message: status === 404 ? 'This page does not exist.' : 'Something went wrong on our side.',
		code: `E${status}`
	};
};
