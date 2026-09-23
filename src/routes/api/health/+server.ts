import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Liveness probe used by Render's health check. Must not touch the database. */
export const GET: RequestHandler = () =>
	json({ status: 'ok', service: 'skillos', time: new Date().toISOString() }, { headers: { 'cache-control': 'no-store' } });
