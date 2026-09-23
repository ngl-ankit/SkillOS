import { eq, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { TOPICS } from '$server/catalog';
import { db } from '$server/db';
import { searchDocuments } from '$server/db/schema';
import { ctx } from '../init';

export type SearchHit = { id: string; kind: string; title: string; snippet: string; href: string };

export const searchRouter = ctx.router({
	/** Unified search: learner's indexed documents first, then the curated catalog. */
	query: ctx.protectedProcedure.input(z.object({ q: z.string().trim().min(1).max(120) })).query(async ({ ctx: c, input }) => {
		const tokens = input.q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
		if (tokens.length === 0) return { hits: [] as SearchHit[] };

		const docHits: SearchHit[] = (
			await db
				.select()
				.from(searchDocuments)
				.where(or(eq(searchDocuments.userId, c.user.id), isNull(searchDocuments.userId)))
				.limit(200)
		)
			.filter((r) => tokens.some((tok) => `${r.title} ${r.body}`.toLowerCase().includes(tok)))
			.slice(0, 10)
			.map((r) => ({ id: r.id, kind: r.entityType, title: r.title, snippet: r.body.slice(0, 140), href: r.href }));

		const catalogHits: SearchHit[] = TOPICS.filter((t) =>
			tokens.some((tok) => `${t.title} ${t.domain} ${t.description}`.toLowerCase().includes(tok))
		)
			.slice(0, 6)
			.map((t) => ({ id: t.key, kind: 'catalog', title: t.title, snippet: t.description, href: '/app/roadmap' }));

		const seen = new Set<string>();
		const hits = [...docHits, ...catalogHits].filter((h) => {
			const key = `${h.kind}:${h.title.toLowerCase()}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
		return { hits: hits.slice(0, 14) };
	})
});
