import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$server/db';
import { dailyPlans, goals } from '$server/db/schema';
import { AppError } from '$server/errors';
import { generateRoadmap } from '$server/engine/roadmap';
import { getPrimaryGoal, getProfile, listGoals, requireGoal } from '$server/services/access';
import { ctx } from '../init';

const level = z.enum(['beginner', 'intermediate', 'advanced']);

export const goalsRouter = ctx.router({
	list: ctx.protectedProcedure.input(z.object({ includeArchived: z.boolean().default(false) }).default({ includeArchived: false })).query(async ({ ctx: c, input }) => {
		const list = await listGoals(c.user.id, input.includeArchived);
		// Attach live roadmap progress so the goal list is informative, not a bare list.
		const { roadmapProgress } = await import('$server/services/progress');
		return Promise.all(
			list.map(async (goal) => {
				const progress = await roadmapProgress(c.user.id, goal.id);
				return { ...goal, progress };
			})
		);
	}),

	primary: ctx.protectedProcedure.query(({ ctx: c }) => getPrimaryGoal(c.user.id)),

	byId: ctx.protectedProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx: c, input }) => {
		const goal = await requireGoal(c.user.id, input.id);
		const { roadmapProgress } = await import('$server/services/progress');
		return { ...goal, progress: await roadmapProgress(c.user.id, goal.id) };
	}),

	create: ctx.protectedProcedure
		.input(
			z.object({
				title: z.string().trim().min(3).max(200),
				level,
				targetRole: z.string().trim().max(120).nullable().default(null),
				dailyMinutes: z.number().int().min(10).max(600).optional(),
				deadline: z
					.string()
					.regex(/^\d{4}-\d{2}-\d{2}$/)
					.nullable()
					.default(null),
				motivation: z.string().trim().max(400).nullable().default(null),
				trackSlug: z.string().max(80).nullable().default(null),
				setPrimary: z.boolean().default(false),
				generateRoadmapNow: z.boolean().default(true),
				today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
			})
		)
		.mutation(async ({ ctx: c, input }) => {
			const profile = await getProfile(c.user.id);
			const dailyMinutes = input.dailyMinutes ?? profile?.dailyMinutes ?? 60;
			const now = new Date();
			if (input.setPrimary) {
				await db.update(goals).set({ isPrimary: false, updatedAt: now }).where(and(eq(goals.userId, c.user.id), eq(goals.isPrimary, true)));
			}
			const [goal] = await db
				.insert(goals)
				.values({
					userId: c.user.id,
					title: input.title,
					trackSlug: input.trackSlug,
					level: input.level,
					targetRole: input.targetRole,
					dailyMinutes,
					deadline: input.deadline,
					motivation: input.motivation,
					status: 'active',
					isPrimary: input.setPrimary
				})
				.returning();

			let roadmapId: string | null = null;
			if (input.generateRoadmapNow) {
				const result = await generateRoadmap({
					userId: c.user.id,
					goalId: goal.id,
					goalTitle: input.title,
					targetRole: input.targetRole,
					level: input.level,
					skills: profile?.existingSkills ?? [],
					dailyMinutes,
					deadline: input.deadline,
					trackSlug: input.trackSlug,
					today: input.today
				});
				roadmapId = result.roadmapId;
			}
			return { goal, roadmapId };
		}),

	update: ctx.protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				title: z.string().trim().min(3).max(200).optional(),
				level: level.optional(),
				targetRole: z.string().trim().max(120).nullable().optional(),
				dailyMinutes: z.number().int().min(10).max(600).optional(),
				deadline: z
					.string()
					.regex(/^\d{4}-\d{2}-\d{2}$/)
					.nullable()
					.optional(),
				motivation: z.string().trim().max(400).nullable().optional(),
				status: z.enum(['active', 'paused', 'completed', 'archived']).optional()
			})
		)
		.mutation(async ({ ctx: c, input }) => {
			await requireGoal(c.user.id, input.id);
			const { id, ...patch } = input;
			const [row] = await db
				.update(goals)
				.set({
					...patch,
					completedAt: patch.status === 'completed' ? new Date() : patch.status ? null : undefined,
					updatedAt: new Date()
				})
				.where(and(eq(goals.id, id), eq(goals.userId, c.user.id)))
				.returning();
			return row;
		}),

	setPrimary: ctx.protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx: c, input }) => {
		const goal = await requireGoal(c.user.id, input.id);
		if (goal.status === 'archived') throw new AppError('PRECONDITION_FAILED', 'Restore this goal before making it primary.');
		const now = new Date();
		await db.update(goals).set({ isPrimary: false, updatedAt: now }).where(and(eq(goals.userId, c.user.id), eq(goals.isPrimary, true)));
		const [row] = await db.update(goals).set({ isPrimary: true, updatedAt: now }).where(eq(goals.id, goal.id)).returning();
		return row;
	}),

	/** Regenerating keeps the goal, replaces the roadmap, and preserves history. */
	regenerateRoadmap: ctx.protectedProcedure
		.input(z.object({ goalId: z.string().uuid(), trackSlug: z.string().max(80).nullable().default(null), today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
		.mutation(async ({ ctx: c, input }) => {
			const goal = await requireGoal(c.user.id, input.goalId);
			const profile = await getProfile(c.user.id);
			const result = await generateRoadmap({
				userId: c.user.id,
				goalId: goal.id,
				goalTitle: goal.title,
				targetRole: goal.targetRole,
				level: goal.level,
				skills: profile?.existingSkills ?? [],
				dailyMinutes: goal.dailyMinutes,
				deadline: goal.deadline,
				trackSlug: input.trackSlug ?? goal.trackSlug,
				today: input.today
			});
			// Today's plan refers to topics that may no longer exist.
			await db.delete(dailyPlans).where(and(eq(dailyPlans.userId, c.user.id), eq(dailyPlans.day, input.today)));
			return { roadmapId: result.roadmapId, topics: result.topicIdsByCatalogKey.size };
		}),

	remove: ctx.protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx: c, input }) => {
		await requireGoal(c.user.id, input.id);
		await db.update(goals).set({ status: 'archived', isPrimary: false, updatedAt: new Date() }).where(and(eq(goals.id, input.id), eq(goals.userId, c.user.id)));
		return { ok: true };
	})
});

void sql;
