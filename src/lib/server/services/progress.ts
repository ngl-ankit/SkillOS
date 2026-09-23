import { and, asc, count, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { addDaysISO, clamp, daysBetween, pct } from '$lib/utils';
import { db } from '../db';
import {
	assessmentAttempts,
	assessments,
	checkIns,
	dailyPlanItems,
	dailyPlans,
	learningSessions,
	notifications,
	projectProgress,
	projects,
	roadmapPhases,
	topicProgress,
	topics
} from '../db/schema';
import { schedule } from '../engine/srs';
import type { Profile } from './access';
import { ensureTopicProgress, type Goal, getPreferences, getRoadmapBundle } from './access';

export type ProgressUpdate = {
	topicId: string;
	status?: 'not_started' | 'in_progress' | 'completed';
	progressPct?: number;
	mastery?: number;
	minutesSpent?: number;
	lastReviewedAt?: Date | null;
	nextReviewAt?: Date | null;
	intervalDays?: number;
	easeFactor?: number;
	reviewCount?: number;
	completedAt?: Date | null;
	startedAt?: Date | null;
};

export async function logSession(input: {
	userId: string;
	topicId?: string | null;
	kind: 'learn' | 'practice' | 'assess' | 'revise' | 'project';
	minutes: number;
	summary?: string;
	day: string;
}) {
	await db.insert(learningSessions).values({
		userId: input.userId,
		topicId: input.topicId ?? null,
		kind: input.kind,
		minutes: clamp(Math.round(input.minutes), 1, 720),
		summary: input.summary ?? null,
		day: input.day
	});
}

/** Applies a progress update, then records the study time against the topic. */
export async function applyProgress(userId: string, update: ProgressUpdate, addMinutes = 0) {
	const current = await ensureTopicProgress(userId, update.topicId);
	const patch: Record<string, unknown> = { updatedAt: new Date() };

	if (update.status !== undefined) patch.status = update.status;
	if (update.progressPct !== undefined) patch.progressPct = clamp(Math.round(update.progressPct), 0, 100);
	if (update.mastery !== undefined) patch.mastery = clamp(Math.round(update.mastery), 0, 100);
	if (update.minutesSpent !== undefined) patch.minutesSpent = Math.max(0, Math.round(update.minutesSpent));
	else if (addMinutes > 0) patch.minutesSpent = current.minutesSpent + Math.round(addMinutes);
	if (update.lastReviewedAt !== undefined) patch.lastReviewedAt = update.lastReviewedAt;
	if (update.nextReviewAt !== undefined) patch.nextReviewAt = update.nextReviewAt;
	if (update.intervalDays !== undefined) patch.intervalDays = Math.max(0, Math.round(update.intervalDays));
	if (update.easeFactor !== undefined) patch.easeFactor = clamp(update.easeFactor, 1.3, 2.8);
	if (update.reviewCount !== undefined) patch.reviewCount = Math.max(0, Math.round(update.reviewCount));
	if (update.completedAt !== undefined) patch.completedAt = update.completedAt;
	if (update.startedAt !== undefined) patch.startedAt = update.startedAt;

	// Transitional bookkeeping: starting implies a start date, completing implies 100%.
	if (update.status === 'in_progress' && !current.startedAt && patch.startedAt === undefined) patch.startedAt = new Date();
	if (update.status === 'completed') {
		patch.completedAt = patch.completedAt ?? new Date();
		patch.progressPct = 100;
		if (patch.startedAt === undefined) patch.startedAt = current.startedAt ?? new Date();
	}

	const [row] = await db
		.update(topicProgress)
		.set(patch)
		.where(and(eq(topicProgress.topicId, update.topicId), eq(topicProgress.userId, userId)))
		.returning();
	return row;
}

/** Records a spacing outcome from a score or grade and stores it on the topic. */
export async function recordReview(userId: string, topicId: string, grade: number, score?: number) {
	const current = await ensureTopicProgress(userId, topicId);
	const outcome = schedule(
		{ easeFactor: current.easeFactor, intervalDays: current.intervalDays, reviewCount: current.reviewCount },
		grade
	);
	const mastery =
		score !== undefined
			? clamp(Math.round(score), 0, 100)
			: clamp(current.mastery + (grade >= 4 ? 6 : grade <= 2 ? -8 : 0), 0, 100);
	return applyProgress(userId, {
		topicId,
		mastery: mastery,
		lastReviewedAt: outcome.lastReviewedAt,
		nextReviewAt: outcome.nextReviewAt,
		intervalDays: outcome.intervalDays,
		easeFactor: outcome.easeFactor,
		reviewCount: outcome.reviewCount,
		progressPct: Math.max(current.progressPct, grade >= 3 ? 100 : current.progressPct)
	});
}

export type PhaseProgress = {
	id: string;
	title: string;
	position: number;
	milestoneTitle: string;
	milestoneReachedAt: Date | null;
	total: number;
	completed: number;
	percent: number;
};

export type RoadmapProgress = {
	roadmapId: string;
	total: number;
	completed: number;
	inProgress: number;
	available: number;
	locked: number;
	percent: number;
	estimatedMinutesRemaining: number;
	phases: PhaseProgress[];
	currentTopicId: string | null;
	projectTotal: number;
	projectDone: number;
};

/** Aggregates roadmap progress from persisted topic state. */
export async function roadmapProgress(userId: string, goalId?: string | null): Promise<RoadmapProgress | null> {
	const bundle = await getRoadmapBundle(userId, goalId);
	if (!bundle) return null;
	const { roadmap, phases, topics: snapshots, projectList, projectState } = bundle;

	const completed = snapshots.filter((t) => t.status === 'completed').length;
	const inProgress = snapshots.filter((t) => t.status === 'in_progress').length;
	const locked = snapshots.filter((t) => !t.available && t.status === 'not_started').length;
	const available = snapshots.filter((t) => t.available && t.status === 'not_started').length;
	const current =
		snapshots.find((t) => t.status === 'in_progress') ?? snapshots.find((t) => t.available && t.status === 'not_started') ?? null;

	const phaseProgress: PhaseProgress[] = phases.map((phase) => {
		const inPhase = snapshots.filter((t) => t.phaseTitle === phase.title);
		const done = inPhase.filter((t) => t.status === 'completed').length;
		return {
			id: phase.id,
			title: phase.title,
			position: phase.position,
			milestoneTitle: phase.milestoneTitle,
			milestoneReachedAt: phase.milestoneReachedAt,
			total: inPhase.length,
			completed: done,
			percent: pct(done, inPhase.length)
		};
	});

	// Reaching a milestone is derived, then persisted the first time it happens.
	for (const phase of phaseProgress) {
		if (phase.total > 0 && phase.percent === 100 && !phase.milestoneReachedAt) {
			await db.update(roadmapPhases).set({ milestoneReachedAt: new Date() }).where(eq(roadmapPhases.id, phase.id));
			phase.milestoneReachedAt = new Date();
		}
	}

	const projectTotal = projectList.length;
	const projectDone = projectList.filter((p) => projectState.get(p.id)?.status === 'completed').length;

	return {
		roadmapId: roadmap.id,
		total: snapshots.length,
		completed,
		inProgress,
		available,
		locked,
		percent: pct(completed, snapshots.length),
		estimatedMinutesRemaining: snapshots.filter((t) => t.status !== 'completed').reduce((sum, t) => sum + t.estimatedMinutes, 0),
		phases: phaseProgress,
		currentTopicId: current?.topicId ?? null,
		projectTotal,
		projectDone
	};
}

export type StreakInfo = { current: number; longest: number; activeDays: string[] };

/** Consecutive days with logged activity, ending today or yesterday. */
export async function streak(userId: string, today: string): Promise<StreakInfo> {
	const rows = await db
		.selectDistinct({ day: learningSessions.day })
		.from(learningSessions)
		.where(and(eq(learningSessions.userId, userId), gte(learningSessions.day, addDaysISO(today, -180))))
		.orderBy(desc(learningSessions.day));
	const days = new Set(rows.map((r) => r.day));
	let current = 0;
	let cursor = days.has(today) ? today : addDaysISO(today, -1);
	if (days.has(cursor)) {
		while (days.has(cursor)) {
			current += 1;
			cursor = addDaysISO(cursor, -1);
		}
	}
	// Longest run across the retained window.
	const sorted = [...days].sort();
	let longest = 0;
	let run = 0;
	let prev: string | null = null;
	for (const day of sorted) {
		if (prev && daysBetween(prev, day) === 1) run += 1;
		else run = 1;
		longest = Math.max(longest, run);
		prev = day;
	}
	return { current, longest, activeDays: rows.slice(0, 30).map((r) => r.day) };
}

export type WeakTopic = {
	topicId: string;
	title: string;
	mastery: number;
	domain: string;
	difficulty: number;
	reasons: string[];
};

/** Topics that most need attention: low retention, failed attempts, or flagged in check-ins. */
export async function weakTopics(userId: string, limit = 6): Promise<WeakTopic[]> {
	const bundle = await getRoadmapBundle(userId);
	if (!bundle) return [];
	const candidates = bundle.topics.filter((t) => t.status === 'in_progress' || t.status === 'completed' || t.mastery > 0);

	const topicIds = candidates.map((t) => t.topicId);
	if (topicIds.length === 0) return [];

	const attempts = await db
		.select({ topicId: assessments.topicId, score: assessmentAttempts.score, passed: assessmentAttempts.passed })
		.from(assessmentAttempts)
		.innerJoin(assessments, eq(assessments.id, assessmentAttempts.assessmentId))
		.where(and(eq(assessmentAttempts.userId, userId), inArray(assessments.topicId, topicIds)))
		.orderBy(desc(assessmentAttempts.createdAt))
		.limit(200);

	const worstScore = new Map<string, number>();
	for (const attempt of attempts) {
		if (!attempt.topicId) continue;
		const seen = worstScore.get(attempt.topicId);
		if (seen === undefined || attempt.score < seen) worstScore.set(attempt.topicId, attempt.score);
	}

	const failures = await db
		.select({ topicId: topics.id, times: count() })
		.from(checkIns)
		.innerJoin(topics, sql`false`)
		.where(eq(checkIns.userId, userId))
		.groupBy(topics.id)
		.limit(0);
	void failures;

	return candidates
		.map((topic) => {
			const reasons: string[] = [];
			const score = worstScore.get(topic.topicId);
			if (score !== undefined && score < 80) reasons.push(`Assessment scored ${score}%`);
			if (topic.mastery < 60) reasons.push(`Retention at ${topic.mastery}%`);
			if (topic.nextReviewAt && new Date(topic.nextReviewAt).getTime() <= Date.now()) reasons.push('Review overdue');
			if (topic.status === 'in_progress' && topic.progressPct < 40 && topic.minutesSpent > 20)
				reasons.push('Stalled part-way through');
			if (reasons.length === 0) return null;
			const score0 = 100 - topic.mastery + (score !== undefined ? Math.max(0, 80 - score) : 0) + topic.difficulty * 3;
			return {
				topic: {
					topicId: topic.topicId,
					title: topic.title,
					mastery: topic.mastery,
					domain: topic.domain,
					difficulty: topic.difficulty,
					reasons
				},
				score: score0
			};
		})
		.filter((x): x is { topic: WeakTopic; score: number } => x !== null)
		.sort((a, b) => b.score - a.score)
		.slice(0, limit)
		.map((x) => x.topic);
}

export type RevisionItem = {
	topicId: string;
	title: string;
	domain: string;
	mastery: number;
	difficulty: number;
	lastReviewedAt: Date | null;
	nextReviewAt: Date | null;
	reviewCount: number;
	intervalDays: number;
	overdueDays: number;
	state: 'due' | 'soon' | 'fresh';
};

/** The spaced-repetition queue for the revision surface. */
export async function revisionQueue(userId: string, today: string): Promise<RevisionItem[]> {
	const bundle = await getRoadmapBundle(userId);
	if (!bundle) return [];
	const now = Date.now();
	const score = (item: RevisionItem) => item.overdueDays * 12 + (100 - item.mastery) * 0.8 + item.difficulty * 4;

	return bundle.topics
		.filter((t) => (t.status !== 'not_started' || t.mastery > 0) && t.available)
		.map((t) => {
			const overdueDays = t.nextReviewAt ? Math.max(0, Math.round((now - new Date(t.nextReviewAt).getTime()) / 86_400_000)) : 0;
			const state: RevisionItem['state'] = !t.nextReviewAt
				? 'fresh'
				: overdueDays > 0
					? 'due'
					: overdueDays >= -2
						? 'soon'
						: 'fresh';
			return {
				topicId: t.topicId,
				title: t.title,
				domain: t.domain,
				mastery: t.mastery,
				difficulty: t.difficulty,
				lastReviewedAt: t.lastReviewedAt,
				nextReviewAt: t.nextReviewAt,
				reviewCount: t.reviewCount,
				intervalDays: t.intervalDays,
				overdueDays,
				state
			};
		})
		.filter((item) => item.state !== 'fresh' || item.mastery < 70)
		.sort((a, b) => score(b) - score(a));
}

/** Counts available notifications, trimmed to the most recent. */
export async function unreadNotifications(userId: string) {
	return db
		.select()
		.from(notifications)
		.where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
		.orderBy(desc(notifications.createdAt))
		.limit(20);
}

/** Marks a project milestone complete and recomputes its status. */
export async function toggleMilestone(userId: string, projectId: string, index: number, done: boolean) {
	const [project] = await db
		.select()
		.from(projects)
		.where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
		.limit(1);
	if (!project) return null;
	const [existing] = await db.select().from(projectProgress).where(eq(projectProgress.projectId, projectId)).limit(1);
	const completed = new Set(existing?.completedMilestones ?? []);
	if (done) completed.add(index);
	else completed.delete(index);
	const list = [...completed].filter((i) => i >= 0 && i < project.milestones.length).sort((a, b) => a - b);
	// Milestones must be finished in order, so gaps collapse to the longest run from the start.
	const contiguous: number[] = [];
	for (let i = 0; i < project.milestones.length; i += 1) {
		if (list.includes(i)) contiguous.push(i);
		else break;
	}
	const status =
		contiguous.length === project.milestones.length ? 'completed' : contiguous.length > 0 ? 'in_progress' : 'not_started';

	if (existing) {
		const [row] = await db
			.update(projectProgress)
			.set({
				completedMilestones: contiguous,
				status,
				startedAt: existing.startedAt ?? new Date(),
				completedAt: status === 'completed' ? (existing.completedAt ?? new Date()) : null,
				updatedAt: new Date()
			})
			.where(eq(projectProgress.id, existing.id))
			.returning();
		return row;
	}
	const [row] = await db
		.insert(projectProgress)
		.values({
			userId,
			projectId,
			completedMilestones: contiguous,
			status,
			startedAt: new Date(),
			completedAt: status === 'completed' ? new Date() : null
		})
		.returning();
	return row;
}

export { and, asc, db, eq };
