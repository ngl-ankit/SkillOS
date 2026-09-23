import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { RESOURCES } from '../src/lib/server/catalog/resources';
import { resources } from '../src/lib/server/db/schema/resources';

/**
 * Seeds the shared resource library from the curated catalog and verifies the
 * connection. Idempotent: re-running updates rows in place.
 */
const url = process.env.DATABASE_URL;
if (!url) {
	console.error('[seed] DATABASE_URL is not set.');
	process.exit(1);
}

const client = postgres(url, { max: 1, onnotice: () => {} });
const db = drizzle(client);

const rows = RESOURCES.map((r) => ({
	slug: r.slug,
	title: r.title,
	url: r.url,
	provider: r.provider,
	type: r.type,
	difficulty: r.difficulty,
	cost: r.cost,
	estimatedMinutes: r.minutes,
	prerequisites: '',
	description: r.description,
	whyUseful: r.why,
	tags: r.tags
}));

let seeded = 0;
for (const row of rows) {
	await db
		.insert(resources)
		.values(row)
		.onConflictDoUpdate({
			target: resources.slug,
			set: {
				title: row.title,
				url: row.url,
				provider: row.provider,
				description: row.description,
				whyUseful: row.why,
				tags: row.tags,
				updatedAt: sql`now()`
			}
		});
	seeded += 1;
}

console.log(`[seed] ${seeded} resources upserted.`);
await client.end({ timeout: 5 });
