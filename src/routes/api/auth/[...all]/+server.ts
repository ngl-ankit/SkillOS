import { auth } from '$server/auth';
import type { RequestHandler } from './$types';

/** Better Auth's full email/password flow lives behind this catch-all. */
export const GET: RequestHandler = ({ request }) => auth.handler(request);
export const POST: RequestHandler = ({ request }) => auth.handler(request);
