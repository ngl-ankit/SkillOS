import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { todayISO } from '$lib/utils';
import { db } from '$server/db';
import { topicProgress } from '$server/db/schema';
import { ensureTopicProgress } from '$server/services/access';
import { recordReview, revisionQueue, streak } from '$server/services/progress';
import { ctx } from '../init';

export const revisionRouter = ctx.router({
	/** The spaced-repetition queue: what to review and how overdue it is. */
	queue: ctx.protectedProcedure
		.input(z.object({ limit: z.number().int().min(1).max(100).default(40) }))
		.query(async ({ ctx: c, input }) => {
			const items = await revisionQueue(c.user.id, todayISO());
			return { items: items.slice(0, input.limit) };
		}),

	/** Records a self-graded review (1 = blank, 5 = instant recall). */
	review: ctx.protectedProcedure
		.input(z.object({ topicId: z.string().uuid(), grade: z.number().int().min(1).max(5) }))
		.mutation(async ({ ctx: c, input }) => {
			await ensureTopicProgress(c.user.id, input.topicId);
			await recordReview(c.user.id, input.topicId, input.grade);
			const [row] = await db
				.select()
				.from(topicProgress)
				.where(and(eq(topicProgress.userId, c.user.id), eq(topicProgress.topicId, input.topicId)))
				.limit(1);
			const queue = await revisionQueue(c.user.id, todayISO());
			return { progress: row ?? null, remaining: queue.filter((i) => i.state === 'due').length };
		}),

	/** Summary counts for the revision header. */
	stats: ctx.protectedProcedure.query(async ({ ctx: c }) => {
		const items = await revisionQueue(c.user.id, todayISO());
		const count = (state: 'due' | 'soon' | 'fresh') => items.filter((i) => i.state === state).length;
		return {
			due: count('due'),
			soon: count('soon'),
			fresh: count('fresh'),
			total: items.length,
			streak: await streak(c.user.id, todayISO())
		};
	}),

	/** Forces a topic back into today's queue by pulling its next review forward. */
	expedite: ctx.protectedProcedure.input(z.object({ topicId: z.string().uuid() })).mutation(async ({ ctx: c, input }) => {
		await ensureTopicProgress(c.user.id, input.topicId);
		const [row] = await db
			.update(topicProgress)
			.set({ nextReviewAt: sql`now()`, updatedAt: new Date() })
			.where(and(eq(topicProgress.userId, c.user.id), eq(topicProgress.topicId, input.topicId)))
			.returning();
		return row ?? null;
	})
});
