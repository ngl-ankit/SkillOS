import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$server/db';
import { notes, projects, topics } from '$server/db/schema';
import { AppError } from '$server/errors';
import { ctx } from '../init';

/** Searchable notes attached to topics, resources or projects. */
export const notesRouter = ctx.router({
	list: ctx.protectedProcedure
		.input(
			z.object({
				query: z.string().trim().max(160).default(''),
				filter: z.enum(['all', 'topic', 'resource', 'project', 'session', 'unlinked']).default('all'),
				limit: z.number().int().min(1).max(200).default(100)
			})
		)
		.query(async ({ ctx: c, input }) => {
			const conditions = [eq(notes.userId, c.user.id)];
			if (input.query.length >= 2) {
				const like = `%${input.query.toLowerCase()}%`;
				conditions.push(sql`(lower(${notes.title}) like ${like} or lower(${notes.body}) like ${like})`);
			}
			if (input.filter === 'topic') conditions.push(sql`${notes.topicId} is not null`);
			if (input.filter === 'resource') conditions.push(sql`${notes.resourceId} is not null`);
			if (input.filter === 'project') conditions.push(sql`${notes.projectId} is not null`);
			if (input.filter === 'session') conditions.push(sql`${notes.sessionId} is not null`);
			if (input.filter === 'unlinked')
				conditions.push(sql`${notes.topicId} is null and ${notes.projectId} is null and ${notes.resourceId} is null`);

			const rows = await db
				.select()
				.from(notes)
				.where(and(...conditions))
				.orderBy(desc(notes.updatedAt))
				.limit(input.limit);

			// Attach the linked entity's title so the list is navigable.
			const topicIds = rows.map((r) => r.topicId).filter((id): id is string => Boolean(id));
			const projectIds = rows.map((r) => r.projectId).filter((id): id is string => Boolean(id));
			const topicTitles = new Map<string, string>();
			const projectTitles = new Map<string, string>();
			if (topicIds.length > 0) {
				for (const row of await db
					.select({ id: topics.id, title: topics.title })
					.from(topics)
					.where(inArray(topics.id, topicIds))) {
					topicTitles.set(row.id, row.title);
				}
			}
			if (projectIds.length > 0) {
				for (const row of await db
					.select({ id: projects.id, title: projects.title })
					.from(projects)
					.where(inArray(projects.id, projectIds))) {
					projectTitles.set(row.id, row.title);
				}
			}

			return rows.map((row) => ({
				...row,
				topicTitle: row.topicId ? (topicTitles.get(row.topicId) ?? null) : null,
				projectTitle: row.projectId ? (projectTitles.get(row.projectId) ?? null) : null,
				excerpt: row.body.replace(/\s+/g, ' ').slice(0, 180)
			}));
		}),

	byId: ctx.protectedProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx: c, input }) => {
		const [row] = await db
			.select()
			.from(notes)
			.where(and(eq(notes.id, input.id), eq(notes.userId, c.user.id)))
			.limit(1);
		if (!row) throw new AppError('NOT_FOUND', 'Note not found');
		return row;
	}),

	create: ctx.protectedProcedure
		.input(
			z.object({
				title: z.string().trim().max(160).default('Note'),
				body: z.string().trim().min(1).max(20000),
				topicId: z.string().uuid().nullable().default(null),
				resourceId: z.string().uuid().nullable().default(null),
				projectId: z.string().uuid().nullable().default(null),
				sessionId: z.string().uuid().nullable().default(null)
			})
		)
		.mutation(async ({ ctx: c, input }) => {
			const [row] = await db
				.insert(notes)
				.values({
					userId: c.user.id,
					title: input.title.trim() || 'Note',
					body: input.body,
					topicId: input.topicId,
					resourceId: input.resourceId,
					projectId: input.projectId,
					sessionId: input.sessionId
				})
				.returning();
			return row;
		}),

	update: ctx.protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				title: z.string().trim().max(160).optional(),
				body: z.string().trim().min(1).max(20000).optional(),
				topicId: z.string().uuid().nullable().optional(),
				projectId: z.string().uuid().nullable().optional()
			})
		)
		.mutation(async ({ ctx: c, input }) => {
			const { id, ...patch } = input;
			const [row] = await db
				.update(notes)
				.set({ ...patch, updatedAt: new Date() })
				.where(and(eq(notes.id, id), eq(notes.userId, c.user.id)))
				.returning();
			if (!row) throw new AppError('NOT_FOUND', 'Note not found');
			return row;
		}),

	remove: ctx.protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx: c, input }) => {
		const [row] = await db
			.delete(notes)
			.where(and(eq(notes.id, input.id), eq(notes.userId, c.user.id)))
			.returning({ id: notes.id });
		if (!row) throw new AppError('NOT_FOUND', 'Note not found');
		return { ok: true };
	}),

	counts: ctx.protectedProcedure.query(async ({ ctx: c }) => {
		const [row] = await db
			.select({
				total: sql<number>`count(*)::int`,
				linked: sql<number>`count(${notes.topicId})::int`,
				projects: sql<number>`count(${notes.projectId})::int`
			})
			.from(notes)
			.where(eq(notes.userId, c.user.id));
		return row ?? { total: 0, linked: 0, projects: 0 };
	})
});
