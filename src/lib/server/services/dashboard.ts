import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { addDaysISO, clamp, daysBetween, humanMinutes, pct } from '$lib/utils';
import { db } from '../db';
import {
	assessmentAttempts,
	assessments,
	checkIns,
	dailyPlanItems,
	dailyPlans,
	learningSessions,
	projectProgress,
	projects,
	topicProgress,
	topics
} from '../db/schema';
import { composePlan } from '../engine/planner';
import type { PlanDraft, TopicSnapshot } from '../engine/types';
import { getPreferences, getPrimaryGoal, getProfile, getRoadmapBundle, isOnboarded, requireProfile, todayPlan } from './access';
import {
	type RevisionItem,
	type RoadmapProgress,
	revisionQueue,
	roadmapProgress,
	type StreakInfo,
	streak,
	type WeakTopic,
	weakTopics
} from './progress';

export type TodayState = {
	onboarded: boolean;
	day: string;
	greeting: string;
	profileName: string;
	goal: { id: string; title: string; deadline: string | null; targetRole: string | null } | null;
	phase: { title: string; index: number; total: number } | null;
	plan: {
		id: string;
		focus: string;
		budgetMinutes: number;
		plannedMinutes: number;
		rationale: string[];
		aiNote: string | null;
		status: 'active' | 'completed' | 'partial' | 'missed';
		items: {
			id: string;
			position: number;
			kind: string;
			title: string;
			detail: string;
			minutes: number;
			status: string;
			ref: Record<string, unknown>;
		}[];
	} | null;
	progress: RoadmapProgress | null;
	currentTopic: {
		topicId: string;
		title: string;
		domain: string;
		progressPct: number;
		estimatedMinutes: number;
		phaseTitle: string;
	} | null;
	nextMilestone: { title: string; detail: string; phaseTitle: string; remainingTopics: number } | null;
	revision: RevisionItem[];
	weak: WeakTopic[];
	streak: StreakInfo;
	project: { id: string; title: string; done: number; total: number; nextMilestone: string | null } | null;
	lastAssessment: { title: string; score: number; passed: boolean; at: Date; topicId: string | null } | null;
	minutesThisWeek: number;
	daysUntilDeadline: number | null;
};

export function greet(now: Date = new Date()): string {
	const hour = now.getHours();
	if (hour < 5) return 'Still up';
	if (hour < 12) return 'Good morning';
	if (hour < 18) return 'Good afternoon';
	return 'Good evening';
}

/**
 * The single source of truth for the dashboard. Composed from persisted learner
 * state so the answer to "what should I do today?" is always grounded in data.
 */
export async function buildToday(userId: string, today: string, now: Date = new Date()): Promise<TodayState> {
	const onboarded = await isOnboarded(userId);
	const profile = await getProfile(userId);
	const goal = await getPrimaryGoal(userId);

	if (!onboarded || !profile || !goal) {
		return {
			onboarded: false,
			day: today,
			greeting: greet(now),
			profileName: profile?.displayName ?? '',
			goal: null,
			phase: null,
			plan: null,
			progress: null,
			currentTopic: null,
			nextMilestone: null,
			revision: [],
			weak: [],
			streak: { current: 0, longest: 0, activeDays: [] },
			project: null,
			lastAssessment: null,
			minutesThisWeek: 0,
			daysUntilDeadline: null
		};
	}

	const [bundle, currentPlan, progress, revision, weak, streakInfo, weekMinutes] = await Promise.all([
		getRoadmapBundle(userId, goal.id),
		todayPlan(userId, today),
		roadmapProgress(userId, goal.id),
		revisionQueue(userId, today),
		weakTopics(userId, 5),
		streak(userId, today),
		minutesSince(userId, addDaysISO(today, -6))
	]);

	const snapshots = bundle?.topics ?? [];
	const current =
		snapshots.find((t) => t.status === 'in_progress') ?? snapshots.find((t) => t.available && t.status === 'not_started') ?? null;

	const phaseIndex = current ? (bundle?.phases.findIndex((p) => p.title === current.phaseTitle) ?? -1) : -1;
	const phase =
		current && phaseIndex >= 0 && bundle
			? { title: current.phaseTitle, index: phaseIndex + 1, total: bundle.phases.length }
			: null;

	const nextMilestone = (() => {
		if (!bundle) return null;
		for (const phaseRow of bundle.phases) {
			const inPhase = snapshots.filter((t) => t.phaseTitle === phaseRow.title);
			const remaining = inPhase.filter((t) => t.status !== 'completed').length;
			if (remaining > 0)
				return {
					title: phaseRow.milestoneTitle,
					detail: phaseRow.milestoneDetail,
					phaseTitle: phaseRow.title,
					remainingTopics: remaining
				};
		}
		return null;
	})();

	const activeProject = (() => {
		if (!bundle || bundle.projectList.length === 0) return null;
		const ranked = [...bundle.projectList].sort((a, b) => {
			const sa = bundle.projectState.get(a.id)?.status ?? 'not_started';
			const sb = bundle.projectState.get(b.id)?.status ?? 'not_started';
			const rank = (s: string) => (s === 'in_progress' ? 0 : s === 'not_started' ? 1 : 2);
			return rank(sa) - rank(sb) || a.difficulty - b.difficulty;
		});
		const chosen = ranked.find((p) => (bundle.projectState.get(p.id)?.status ?? 'not_started') !== 'completed') ?? ranked[0];
		if (!chosen) return null;
		const state = bundle.projectState.get(chosen.id);
		const done = state?.completedMilestones.length ?? 0;
		return {
			id: chosen.id,
			title: chosen.title,
			done,
			total: chosen.milestones.length,
			nextMilestone: chosen.milestones[done]?.title ?? null
		};
	})();

	const lastAttempt = await latestAttempt(userId);

	return {
		onboarded: true,
		day: today,
		greeting: greet(now),
		profileName: profile.displayName,
		goal: { id: goal.id, title: goal.title, deadline: goal.deadline, targetRole: goal.targetRole },
		phase,
		plan: currentPlan
			? {
					id: currentPlan.plan.id,
					focus: currentPlan.plan.focus,
					budgetMinutes: currentPlan.plan.budgetMinutes,
					plannedMinutes: currentPlan.plan.plannedMinutes,
					rationale: currentPlan.plan.rationale,
					aiNote: currentPlan.plan.aiNote,
					status: currentPlan.plan.status,
					items: currentPlan.items.map((i) => ({
						id: i.id,
						position: i.position,
						kind: i.kind,
						title: i.title,
						detail: i.detail,
						minutes: i.minutes,
						status: i.status,
						ref: i.ref as Record<string, unknown>
					}))
				}
			: null,
		progress,
		currentTopic: current
			? {
					topicId: current.topicId,
					title: current.title,
					domain: current.domain,
					progressPct: current.progressPct,
					estimatedMinutes: current.estimatedMinutes,
					phaseTitle: current.phaseTitle
				}
			: null,
		nextMilestone,
		revision: revision.slice(0, 4),
		weak,
		streak: streakInfo,
		project: activeProject,
		lastAssessment: lastAttempt,
		minutesThisWeek: weekMinutes,
		daysUntilDeadline: goal.deadline ? Math.max(0, daysBetween(today, goal.deadline)) : null
	};
}

async function minutesSince(userId: string, fromDay: string): Promise<number> {
	const [row] = await db
		.select({ total: sql<number>`coalesce(sum(${learningSessions.minutes}), 0)::int` })
		.from(learningSessions)
		.where(and(eq(learningSessions.userId, userId), gte(learningSessions.day, fromDay)));
	return row?.total ?? 0;
}

async function latestAttempt(userId: string) {
	const [row] = await db
		.select({
			title: assessments.title,
			topicId: assessments.topicId,
			score: assessmentAttempts.score,
			passed: assessmentAttempts.passed,
			at: assessmentAttempts.createdAt
		})
		.from(assessmentAttempts)
		.innerJoin(assessments, eq(assessments.id, assessmentAttempts.assessmentId))
		.where(eq(assessmentAttempts.userId, userId))
		.orderBy(desc(assessmentAttempts.createdAt))
		.limit(1);
	return row ?? null;
}

/**
 * Ensures today's plan exists. Plans are built from live learner state, so a
 * missing plan is generated once and then persisted for the rest of the day.
 */
export async function ensureTodayPlan(
	userId: string,
	today: string,
	force = false
): Promise<{ planId: string; created: boolean }> {
	const existing = await todayPlan(userId, today);
	if (existing && !force) return { planId: existing.plan.id, created: false };

	const profile = await requireProfile(userId);
	const prefs = await getPreferences(userId);
	const goal = await getPrimaryGoal(userId);
	const bundle = await getRoadmapBundle(userId, goal?.id ?? null);
	const snapshots = bundle?.topics ?? [];

	const revision = await revisionQueue(userId, today);
	const weak = await weakTopics(userId, 8);
	const carryOver = await carryOverItems(userId, today);
	const activeProject = await activeProjectDraft(userId, bundle);

	// Yesterday's check-in tailors today's intensity and revision weight.
	const yesterday = (
		await db
			.select()
			.from(checkIns)
			.where(and(eq(checkIns.userId, userId), eq(checkIns.day, addDaysISO(today, -1))))
			.limit(1)
	)[0];

	const intensity = clamp(prefs.intensity, 50, 150) / 100;
	const budget = clamp(Math.round(profile.dailyMinutes * intensity), 10, 600);

	const draft = composePlan({
		budgetMinutes: budget,
		goalTitle: goal?.title ?? 'Your goal',
		topics: snapshots,
		dueReviews: snapshots.filter((t) => t.nextReviewAt && new Date(t.nextReviewAt).getTime() <= Date.now()),
		weakTopics: weak.map((w) => snapshots.find((t) => t.topicId === w.topicId)).filter((t): t is TopicSnapshot => Boolean(t)),
		carryOver,
		activeProject,
		learningStyle: profile.learningStyle,
		level: profile.level,
		adaptation: {
			intensity: prefs.intensity,
			reviewBias: yesterday?.reviewBias ?? 0
		},
		hasAssessment: revision.length > 0
	});

	return persistPlan(userId, goal?.id ?? null, today, draft, force);
}

async function carryOverItems(userId: string, today: string) {
	const previous = await db
		.select()
		.from(dailyPlans)
		.where(and(eq(dailyPlans.userId, userId), gte(dailyPlans.day, addDaysISO(today, -3)), sql`${dailyPlans.day} < ${today}`))
		.orderBy(desc(dailyPlans.day))
		.limit(1);
	const plan = previous[0];
	if (!plan) return [];
	const rows = await db
		.select()
		.from(dailyPlanItems)
		.where(and(eq(dailyPlanItems.planId, plan.id), eq(dailyPlanItems.status, 'pending')));
	return rows.slice(0, 3).map((row) => ({
		title: row.title,
		detail: row.detail,
		minutes: row.minutes,
		kind: row.kind,
		topicId: (row.ref as { topicId?: string }).topicId
	}));
}

async function activeProjectDraft(userId: string, bundle: Awaited<ReturnType<typeof getRoadmapBundle>>) {
	if (!bundle) return null;
	const ids = bundle.projectList.map((p) => p.id);
	if (ids.length === 0) return null;
	const states = await db
		.select()
		.from(projectProgress)
		.where(and(eq(projectProgress.userId, userId), inArray(projectProgress.projectId, ids)));
	const byId = new Map(states.map((s) => [s.projectId, s]));
	const candidates = bundle.projectList.filter((p) => (byId.get(p.id)?.status ?? 'not_started') !== 'completed');
	const chosen = candidates.sort((a, b) => {
		const ra = byId.get(a.id) ? 0 : 1;
		const rb = byId.get(b.id) ? 0 : 1;
		return ra - rb || a.difficulty - b.difficulty;
	})[0];
	if (!chosen) return null;
	const done = byId.get(chosen.id)?.completedMilestones.length ?? 0;
	return {
		id: chosen.id,
		title: chosen.title,
		nextMilestone: chosen.milestones[done]?.title ?? null,
		minutesPerDay: clamp(Math.round((chosen.estimatedHours * 60) / 12), 20, 90)
	};
}

export async function persistPlan(
	userId: string,
	goalId: string | null,
	day: string,
	draft: PlanDraft,
	replace: boolean
): Promise<{ planId: string; created: boolean }> {
	return db.transaction(async (tx) => {
		const [existing] = await tx
			.select()
			.from(dailyPlans)
			.where(and(eq(dailyPlans.userId, userId), eq(dailyPlans.day, day)))
			.limit(1);

		if (existing) {
			if (!replace) return { planId: existing.id, created: false };
			await tx.delete(dailyPlanItems).where(eq(dailyPlanItems.planId, existing.id));
			await tx
				.update(dailyPlans)
				.set({
					goalId,
					budgetMinutes: draft.budgetMinutes,
					plannedMinutes: draft.plannedMinutes,
					focus: draft.focus,
					rationale: draft.rationale,
					status: 'active',
					updatedAt: new Date()
				})
				.where(eq(dailyPlans.id, existing.id));
			if (draft.items.length > 0) {
				await tx.insert(dailyPlanItems).values(
					draft.items.map((item) => ({
						planId: existing.id,
						userId,
						position: item.position,
						kind: item.kind,
						title: item.title,
						detail: item.detail,
						minutes: item.minutes,
						ref: item.ref
					}))
				);
			}
			return { planId: existing.id, created: false };
		}

		const [plan] = await tx
			.insert(dailyPlans)
			.values({
				userId,
				goalId,
				day,
				budgetMinutes: draft.budgetMinutes,
				plannedMinutes: draft.plannedMinutes,
				focus: draft.focus,
				rationale: draft.rationale,
				status: 'active'
			})
			.returning({ id: dailyPlans.id });

		if (draft.items.length > 0) {
			await tx.insert(dailyPlanItems).values(
				draft.items.map((item) => ({
					planId: plan.id,
					userId,
					position: item.position,
					kind: item.kind,
					title: item.title,
					detail: item.detail,
					minutes: item.minutes,
					ref: item.ref
				}))
			);
		}
		return { planId: plan.id, created: true };
	});
}

/** Weekly activity series for the progress surface. */
export async function activitySeries(userId: string, today: string, days = 14) {
	const from = addDaysISO(today, -(days - 1));
	const rows = await db
		.select({
			day: learningSessions.day,
			minutes: sql<number>`sum(${learningSessions.minutes})::int`,
			kind: learningSessions.kind
		})
		.from(learningSessions)
		.where(and(eq(learningSessions.userId, userId), gte(learningSessions.day, from)))
		.groupBy(learningSessions.day, learningSessions.kind);

	const byDay = new Map<string, number>();
	for (const row of rows) byDay.set(row.day, (byDay.get(row.day) ?? 0) + row.minutes);
	const series: { day: string; minutes: number }[] = [];
	for (let i = 0; i < days; i += 1) {
		const day = addDaysISO(from, i);
		series.push({ day, minutes: byDay.get(day) ?? 0 });
	}
	const total = series.reduce((sum, s) => sum + s.minutes, 0);
	const activeDays = series.filter((s) => s.minutes > 0).length;
	return {
		series,
		totalMinutes: total,
		activeDays,
		averageMinutes: activeDays > 0 ? Math.round(total / activeDays) : 0,
		consistency: pct(activeDays, days)
	};
}

export { humanMinutes, topicProgress, topics };
