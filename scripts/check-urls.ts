import { RESOURCES } from '../src/lib/server/catalog/resources';

/** Verifies every curated resource URL still responds. Run: bun run links:check */
const results = await Promise.all(
	RESOURCES.map(async (r) => {
		try {
			const res = await fetch(r.url, {
				redirect: 'follow',
				headers: { 'user-agent': 'Mozilla/5.0 (SkillOS link check)' },
				signal: AbortSignal.timeout(20000)
			});
			return { slug: r.slug, status: res.status };
		} catch {
			return { slug: r.slug, status: 0 };
		}
	})
);
// 403 = bot protection on a live page (e.g. Cloudflare challenge); reported, not failed.
for (const r of results.filter((x) => x.status === 403)) console.info('protected', r.slug);
const bad = results.filter((r) => r.status === 0 || (r.status >= 400 && r.status !== 403));
for (const r of bad) console.error('broken', r.slug, r.status);
console.info(`${results.length - bad.length}/${results.length} reachable`);
process.exit(bad.length ? 1 : 0);
