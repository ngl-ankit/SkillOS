import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { addDaysISO, todayISO } from '$lib/utils';
import { db } from '$server/db';
import { checkIns, dailyPlanItems, dailyPlans, learningSessions } from '$server/db/schema';
import { getPreferences } from '$server/services/access';
import { ctx } from '../init';
import { submitCheckIn } from './plan';

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const checkInRouter = ctx.router({
	today: ctx.protectedProcedure.input(z.object({ day: daySchema.optional() })).query(async ({ ctx: c, input }) => {
		const day = input.day ?? todayISO();
		const [existing] = await db
			.select()
			.from(checkIns)
			.where(and(eq(checkIns.userId, c.user.id), eq(checkIns.day, day)))
			.limit(1);
		const [plan] = await db
			.select()
			.from(dailyPlans)
			.where(and(eq(dailyPlans.userId, c.user.id), eq(dailyPlans.day, day)))
			.limit(1);
		const items = plan ? await db.select().from(dailyPlanItems).where(eq(dailyPlanItems.planId, plan.id)) : [];
		const [minutes] = await db
			.select({ total: sql<number>`coalesce(sum(${learningSessions.minutes}), 0)::int` })
			.from(learningSessions)
			.where(and(eq(learningSessions.userId, c.user.id), eq(learningSessions.day, day)));
		const previous = await db
			.select()
			.from(checkIns)
			.where(and(eq(checkIns.userId, c.user.id), sql`${checkIns.day} < ${day}`))
			.orderBy(desc(checkIns.day))
			.limit(7);
		const prefs = await getPreferences(c.user.id);

		// Consecutive check-in days ending yesterday, plus today.
		let streakDays = 1;
		let cursor = addDaysISO(day, -1);
		for (const row of previous) {
			if (row.day === cursor) {
				streakDays += 1;
				cursor = addDaysISO(cursor, -1);
			} else if (row.day < cursor) break;
		}

		return {
			day,
			existing: existing ?? null,
			previous,
			intensity: prefs.intensity,
			streakOfCheckIns: streakDays,
			plan: plan
				? {
						id: plan.id,
						focus: plan.focus,
						budgetMinutes: plan.budgetMinutes,
						plannedMinutes: plan.plannedMinutes,
						rationale: plan.rationale
					}
				: null,
			itemsDone: items.filter((i) => i.status === 'done').length,
			itemsTotal: items.length,
			minutesLogged: minutes?.total ?? 0,
			candidates: items
				.map((i) => ({ ref: i.ref as { topicId?: string }, title: i.title }))
				.filter((i) => Boolean(i.ref?.topicId))
				.map((i) => ({ topicId: i.ref.topicId as string, title: i.title }))
		};
	}),

	submit: ctx.protectedProcedure
		.input(
			z.object({
				day: daySchema.optional(),
				completedPlan: z.enum(['yes', 'partly', 'no']),
				minutesStudied: z.number().int().min(0).max(720),
				difficulty: z.number().int().min(1).max(5),
				confidence: z.number().int().min(1).max(5),
				blockers: z
					.array(z.enum(['time', 'confusion', 'motivation', 'environment', 'illness', 'work', 'other']))
					.max(7)
					.default([]),
				blockerNote: z.string().trim().max(600).nullable().default(null),
				tomorrow: z.enum(['lighter', 'similar', 'harder']),
				topicsCovered: z.array(z.string().uuid()).max(20).default([])
			})
		)
		.mutation(({ ctx: c, input }) => submitCheckIn(c.user.id, input)),

	history: ctx.protectedProcedure
		.input(z.object({ limit: z.number().int().min(1).max(60).default(14) }))
		.query(async ({ ctx: c, input }) =>
			db.select().from(checkIns).where(eq(checkIns.userId, c.user.id)).orderBy(desc(checkIns.day)).limit(input.limit)
		),

	/** Signal used by the dashboard to nudge a missing check-in. */
	pending: ctx.protectedProcedure.query(async ({ ctx: c }) => {
		const day = todayISO();
		const [existing] = await db
			.select({ id: checkIns.id })
			.from(checkIns)
			.where(and(eq(checkIns.userId, c.user.id), eq(checkIns.day, day)))
			.limit(1);
		const [logged] = await db
			.select({ total: sql<number>`coalesce(sum(${learningSessions.minutes}), 0)::int` })
			.from(learningSessions)
			.where(and(eq(learningSessions.userId, c.user.id), eq(learningSessions.day, day)));
		return { day, done: Boolean(existing), minutesLogged: logged?.total ?? 0 };
	})
});
