import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

/** Every /app route requires a live session — enforced server-side. */
export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(302, `/auth?next=${encodeURIComponent(url.pathname)}`);
	return { user: locals.user };
};
