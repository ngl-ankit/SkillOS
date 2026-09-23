import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$server/db';
import { notifications } from '$server/db/schema';
import { ctx } from '../init';

export const notificationsRouter = ctx.router({
	list: ctx.protectedProcedure
		.input(z.object({ limit: z.number().int().min(1).max(50).default(20) }))
		.query(async ({ ctx: c, input }) => {
			return db
				.select()
				.from(notifications)
				.where(eq(notifications.userId, c.user.id))
				.orderBy(desc(notifications.createdAt))
				.limit(input.limit);
		}),

	unreadCount: ctx.protectedProcedure.query(async ({ ctx: c }) => {
		const [row] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(notifications)
			.where(and(eq(notifications.userId, c.user.id), eq(notifications.read, false)));
		return { count: row?.count ?? 0 };
	}),

	markRead: ctx.protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx: c, input }) => {
		await db
			.update(notifications)
			.set({ read: true })
			.where(and(eq(notifications.id, input.id), eq(notifications.userId, c.user.id)));
		return { ok: true };
	}),

	markAllRead: ctx.protectedProcedure.mutation(async ({ ctx: c }) => {
		await db
			.update(notifications)
			.set({ read: true })
			.where(and(eq(notifications.userId, c.user.id), eq(notifications.read, false)));
		return { ok: true };
	})
});
