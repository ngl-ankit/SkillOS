import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { addDaysISO, todayISO } from '$lib/utils';
import { db } from '$server/db';
import {
	assessmentAttempts,
	assessments,
	checkIns,
	dailyPlanItems,
	dailyPlans,
	learningSessions,
	topicProgress,
	topics,
	userPreferences
} from '$server/db/schema';
import { gradeFromCheckIn } from '$server/engine/srs';
import { AppError } from '$server/errors';
import { ensureTopicProgress, getPreferences, getProfile, getRoadmapBundle } from '$server/services/access';
import { buildToday, ensureTodayPlan } from '$server/services/dashboard';
import { rememberFact } from '$server/services/learner-context';
import { applyProgress, logSession, recordReview } from '$server/services/progress';
import { ctx } from '../init';

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Shared check-in writer used by both the check-in router and the plan surface. */
export async function submitCheckIn(
	userId: string,
	input: {
		day?: string;
		completedPlan: 'yes' | 'partly' | 'no';
		minutesStudied: number;
		difficulty: number;
		confidence: number;
		blockers: ('time' | 'confusion' | 'motivation' | 'environment' | 'illness' | 'work' | 'other')[];
		blockerNote: string | null;
		tomorrow: 'lighter' | 'similar' | 'harder';
		topicsCovered: string[];
	}
) {
	const day = input.day ?? todayISO();
	const [plan] = await db
		.select()
		.from(dailyPlans)
		.where(and(eq(dailyPlans.userId, userId), eq(dailyPlans.day, day)))
		.limit(1);

	// Signals derived from the answers, folded into the next plan.
	const difficultySignal = input.difficulty - 3;
	const confidenceSignal = input.confidence - 3;
	const reviewBias = Math.round(-confidenceSignal * 10 + (input.completedPlan === 'no' ? 15 : 0));

	const adaptationParts: string[] = [];
	if (input.completedPlan === 'no') adaptationParts.push('yesterday was missed');
	else if (input.completedPlan === 'partly') adaptationParts.push('yesterday was partially completed');
	if (difficultySignal >= 1) adaptationParts.push('the material felt hard');
	if (confidenceSignal <= -1) adaptationParts.push('confidence was low');
	if (input.blockers.length > 0) adaptationParts.push(`blocked by ${input.blockers.join(', ')}`);
	const adaptation =
		adaptationParts.length > 0
			? `Adjusted the next plan because ${adaptationParts.join('; ')}.`
			: 'No change needed — the plan is matching your capacity.';

	const prefs = await getPreferences(userId);
	const delta = input.tomorrow === 'lighter' ? -12 : input.tomorrow === 'harder' ? 10 : 0;
	const nextIntensity = Math.max(50, Math.min(150, Math.round(prefs.intensity * 0.6 + (prefs.intensity + delta) * 0.4)));

	const [row] = await db
		.insert(checkIns)
		.values({
			userId,
			planId: plan?.id ?? null,
			day,
			completedPlan: input.completedPlan,
			minutesStudied: input.minutesStudied,
			difficulty: input.difficulty,
			confidence: input.confidence,
			blockers: input.blockers,
			blockerNote: input.blockerNote,
			tomorrow: input.tomorrow,
			adaptation,
			reviewBias,
			intensityAfter: nextIntensity
		})
		.onConflictDoUpdate({
			target: [checkIns.userId, checkIns.day],
			set: {
				completedPlan: input.completedPlan,
				minutesStudied: input.minutesStudied,
				difficulty: input.difficulty,
				confidence: input.confidence,
				blockers: input.blockers,
				blockerNote: input.blockerNote,
				tomorrow: input.tomorrow,
				adaptation,
				reviewBias,
				intensityAfter: nextIntensity
			}
		})
		.returning();

	if (plan) {
		const status = input.completedPlan === 'yes' ? 'completed' : input.completedPlan === 'partly' ? 'partial' : 'missed';
		await db.update(dailyPlans).set({ status, updatedAt: new Date() }).where(eq(dailyPlans.id, plan.id));
	}

	await db
		.update(userPreferences)
		.set({ intensity: nextIntensity, updatedAt: new Date() })
		.where(eq(userPreferences.userId, userId));

	if (input.confidence <= 2) {
		await rememberFact({
			userId,
			kind: 'preference',
			key: `confidence-${day}`,
			content: `Reported low confidence (${input.confidence}/5) after studying ${input.minutesStudied} min on ${day}.`,
			source: 'check_in',
			confidence: 70
		});
	}
	for (const blocker of input.blockers) {
		await rememberFact({
			userId,
			kind: 'mistake',
			key: `blocker-${blocker}`,
			content: `Recurring blocker: ${blocker}${input.blockerNote ? ` — ${input.blockerNote.slice(0, 200)}` : ''}`,
			source: 'check_in',
			confidence: 55
		});
	}
	if (input.topicsCovered.length > 0) {
		const grade = gradeFromCheckIn(input.confidence, input.completedPlan);
		for (const topicId of input.topicsCovered.slice(0, 10)) {
			await ensureTopicProgress(userId, topicId);
			await recordReview(userId, topicId, grade);
		}
	}
	if (input.minutesStudied > 0) {
		await logSession({ userId, topicId: null, kind: 'learn', minutes: input.minutesStudied, day, summary: 'Daily check-in' });
	}

	return { checkIn: row, nextIntensity, adaptation, tomorrowPlanDay: addDaysISO(day, 1) };
}

export const planRouter = ctx.router({
	/** Today's plan, generated on first read so the dashboard is never empty. */
	today: ctx.protectedProcedure.input(z.object({ day: daySchema.optional() })).query(async ({ ctx: c, input }) => {
		const day = input.day ?? todayISO();
		const existing = await db
			.select({ id: dailyPlans.id })
			.from(dailyPlans)
			.where(and(eq(dailyPlans.userId, c.user.id), eq(dailyPlans.day, day)))
			.limit(1);
		if (existing.length === 0) {
			const profile = await getProfile(c.user.id);
			if (profile?.onboardedAt) await ensureTodayPlan(c.user.id, day);
		}
		return buildToday(c.user.id, day);
	}),

	/** Rebuilds the plan from current state, optionally with an AI refinement pass. */
	regenerate: ctx.protectedProcedure
		.input(z.object({ day: daySchema.optional(), useAi: z.boolean().default(true) }))
		.mutation(async ({ ctx: c, input }) => {
			const day = input.day ?? todayISO();
			const profile = await getProfile(c.user.id);
			if (!profile?.onboardedAt) throw new AppError('PRECONDITION_FAILED', 'Finish onboarding first.');
			if (input.useAi) {
				const { planWithAi } = await import('$server/services/ai-planner');
				const result = await planWithAi(c.user.id, day, true);
				return { planId: result.planId, refined: result.refined, note: result.note, day };
			}
			const result = await ensureTodayPlan(c.user.id, day, true);
			return { planId: result.planId, refined: false, note: null, day };
		}),

	/** Marks a plan item done and propagates the effect into topic progress. */
	completeItem: ctx.protectedProcedure
		.input(
			z.object({
				itemId: z.string().uuid(),
				minutes: z.number().int().min(0).max(600).default(0),
				skipped: z.boolean().default(false)
			})
		)
		.mutation(async ({ ctx: c, input }) => {
			const [item] = await db
				.select()
				.from(dailyPlanItems)
				.where(and(eq(dailyPlanItems.id, input.itemId), eq(dailyPlanItems.userId, c.user.id)))
				.limit(1);
			if (!item) throw new AppError('NOT_FOUND', 'Plan item not found');

			const status = input.skipped ? 'skipped' : 'done';
			const [updated] = await db
				.update(dailyPlanItems)
				.set({ status, completedAt: new Date() })
				.where(eq(dailyPlanItems.id, item.id))
				.returning();

			const topicId = (item.ref as { topicId?: string } | null)?.topicId;
			const effectiveMinutes = input.minutes > 0 ? input.minutes : item.minutes;
			const kind = item.kind === 'carry_over' ? 'learn' : item.kind;

			if (!input.skipped && topicId) {
				await applyProgress(c.user.id, { topicId }, effectiveMinutes);
				if (kind === 'revise') await recordReview(c.user.id, topicId, 4);
				if (kind === 'learn') await applyProgress(c.user.id, { topicId, progressPct: 100 });
			}
			if (!input.skipped && effectiveMinutes > 0) {
				await logSession({
					userId: c.user.id,
					topicId: topicId ?? null,
					kind:
						kind === 'assess'
							? 'assess'
							: kind === 'project'
								? 'project'
								: kind === 'revise'
									? 'revise'
									: kind === 'practice'
										? 'practice'
										: 'learn',
					minutes: effectiveMinutes,
					day: todayISO(),
					summary: item.title
				});
			}

			const siblings = await db.select().from(dailyPlanItems).where(eq(dailyPlanItems.planId, item.planId));
			const pending = siblings.filter((s) => s.status === 'pending').length;
			const done = siblings.filter((s) => s.status === 'done').length;
			const planStatus = pending === 0 ? (done === siblings.length ? 'completed' : 'partial') : 'active';
			await db.update(dailyPlans).set({ status: planStatus, updatedAt: new Date() }).where(eq(dailyPlans.id, item.planId));

			return { item: updated, planStatus, remaining: pending };
		}),

	reopenItem: ctx.protectedProcedure.input(z.object({ itemId: z.string().uuid() })).mutation(async ({ ctx: c, input }) => {
		const [row] = await db
			.update(dailyPlanItems)
			.set({ status: 'pending', completedAt: null })
			.where(and(eq(dailyPlanItems.id, input.itemId), eq(dailyPlanItems.userId, c.user.id)))
			.returning();
		if (!row) throw new AppError('NOT_FOUND', 'Plan item not found');
		await db.update(dailyPlans).set({ status: 'active', updatedAt: new Date() }).where(eq(dailyPlans.id, row.planId));
		return row;
	}),

	/** Check-in is available from the plan surface too, sharing one implementation. */
	checkIn: ctx.protectedProcedure
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

	addItem: ctx.protectedProcedure
		.input(
			z.object({
				day: daySchema.optional(),
				kind: z.enum(['learn', 'practice', 'assess', 'revise', 'project', 'carry_over']),
				title: z.string().trim().min(3).max(160),
				detail: z.string().trim().max(400).default(''),
				minutes: z.number().int().min(5).max(240)
			})
		)
		.mutation(async ({ ctx: c, input }) => {
			const day = input.day ?? todayISO();
			const { planId } = await ensureTodayPlan(c.user.id, day);
			const last = await db
				.select({ position: dailyPlanItems.position })
				.from(dailyPlanItems)
				.where(eq(dailyPlanItems.planId, planId))
				.orderBy(desc(dailyPlanItems.position))
				.limit(1);
			const [row] = await db
				.insert(dailyPlanItems)
				.values({
					planId,
					userId: c.user.id,
					position: (last[0]?.position ?? 0) + 1,
					kind: input.kind,
					title: input.title,
					detail: input.detail,
					minutes: input.minutes,
					ref: {}
				})
				.returning();
			return row;
		}),

	removeItem: ctx.protectedProcedure.input(z.object({ itemId: z.string().uuid() })).mutation(async ({ ctx: c, input }) => {
		await db.delete(dailyPlanItems).where(and(eq(dailyPlanItems.id, input.itemId), eq(dailyPlanItems.userId, c.user.id)));
		return { ok: true };
	}),

	/** Plan history with items and the matching check-in. */
	history: ctx.protectedProcedure
		.input(z.object({ limit: z.number().int().min(1).max(90).default(30) }))
		.query(async ({ ctx: c, input }) => {
			const plans = await db
				.select()
				.from(dailyPlans)
				.where(eq(dailyPlans.userId, c.user.id))
				.orderBy(desc(dailyPlans.day))
				.limit(input.limit);
			const ids = plans.map((p) => p.id);
			const items = ids.length > 0 ? await db.select().from(dailyPlanItems).where(inArray(dailyPlanItems.planId, ids)) : [];
			const checkInRows = await db
				.select()
				.from(checkIns)
				.where(eq(checkIns.userId, c.user.id))
				.orderBy(desc(checkIns.day))
				.limit(input.limit);
			const byPlan = new Map<string, typeof items>();
			for (const item of items) {
				const list = byPlan.get(item.planId) ?? [];
				list.push(item);
				byPlan.set(item.planId, list);
			}
			return plans.map((plan) => ({
				...plan,
				items: (byPlan.get(plan.id) ?? []).sort((a, b) => a.position - b.position),
				checkIn: checkInRows.find((ci) => ci.day === plan.day) ?? null
			}));
		}),

	/** Minutes logged per day for the last N days, used by the progress chart. */
	activity: ctx.protectedProcedure
		.input(z.object({ days: z.number().int().min(7).max(90).default(30) }))
		.query(async ({ ctx: c, input }) => {
			const from = addDaysISO(todayISO(), -(input.days - 1));
			const rows = await db
				.select({ day: learningSessions.day, minutes: sql<number>`sum(${learningSessions.minutes})::int` })
				.from(learningSessions)
				.where(and(eq(learningSessions.userId, c.user.id), sql`${learningSessions.day} >= ${from}`))
				.groupBy(learningSessions.day)
				.orderBy(asc(learningSessions.day));
			return rows;
		})
});

export { assessmentAttempts, assessments, topicProgress, topics };
