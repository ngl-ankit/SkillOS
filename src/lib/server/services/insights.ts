import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { clamp, pct } from '$lib/utils';
import { db } from '../db';
import {
	assessmentAttempts,
	assessmentQuestions,
	assessments,
	checkIns,
	dailyPlanItems,
	dailyPlans,
	notes,
	projectProgress,
	projects,
	roadmapPhases,
	roadmaps,
	topics
} from '../db/schema';
import { revisionQueue, weakTopics } from './progress';

export type Insight = {
	headline: string;
	observations: string[];
	actions: { title: string; detail: string; minutes: number }[];
	focusTopic: string | null;
	/** Deterministic fallback so the surface is never empty when AI is off. */
	generated: boolean;
};

export type LearningStats = {
	minutesTotal: number;
	minutesLast7: number;
	activeDaysLast30: number;
	sessionsLast30: number;
	topicCompletion: { completed: number; total: number; percent: number };
	assessmentAverage: number | null;
	assessmentCount: number;
	streakWeeks: number;
	planAdherence: number | null;
	projectsCompleted: number;
	notesCount: number;
	weakCount: number;
	dueCount: number;
	domainBreakdown: { domain: string; completed: number; total: number; percent: number }[];
};

/** Deterministic analytics computed entirely from persisted rows. */
export async function learningStats(userId: string, today: string): Promise<LearningStats> {
	const [sessionAgg] = await db
		.select({
			total: sql<number>`coalesce(sum(${sql.raw('minutes')}), 0)::int`
		})
		.from(sql`learning_sessions`)
		.where(sql`user_id = ${userId}`);

	const topicRows = await db
		.select({ id: topics.id, domain: topics.domain, status: sql<string>`coalesce(${sql.raw('tp.status')}, 'not_started')` })
		.from(sql`topics t`)
		.leftJoin(sql`topic_progress tp`, sql`tp.topic_id = t.id`)
		.where(sql`t.user_id = ${userId}`);

	const minutesRows = await db
		.select({ day: sql<string>`day`, minutes: sql<number>`sum(minutes)::int` })
		.from(sql`learning_sessions`)
		.where(sql`user_id = ${userId}`)
		.groupBy(sql`day`);

	const attempts = await db
		.select({ score: assessmentAttempts.score, createdAt: assessmentAttempts.createdAt })
		.from(assessmentAttempts)
		.where(eq(assessmentAttempts.userId, userId))
		.orderBy(desc(assessmentAttempts.createdAt))
		.limit(50);

	const planRows = await db
		.select({ status: dailyPlans.status })
		.from(dailyPlans)
		.where(eq(dailyPlans.userId, userId))
		.orderBy(desc(dailyPlans.day))
		.limit(30);

	const [projectAgg] = await db
		.select({ done: sql<number>`count(*)::int` })
		.from(projectProgress)
		.where(and(eq(projectProgress.userId, userId), eq(projectProgress.status, 'completed')));

	const [noteAgg] = await db.select({ total: sql<number>`count(*)::int` }).from(notes).where(eq(notes.userId, userId));

	const [revision, weak] = await Promise.all([revisionQueue(userId, today), weakTopics(userId, 20)]);

	const last7 = minutesRows.filter((r) => r.day >= new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10));
	const last30 = minutesRows.filter((r) => r.day >= new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10));

	const domains = new Map<string, { completed: number; total: number }>();
	for (const row of topicRows) {
		const bucket = domains.get(row.domain) ?? { completed: 0, total: 0 };
		bucket.total += 1;
		if (row.status === 'completed') bucket.completed += 1;
		domains.set(row.domain, bucket);
	}

	const completedTopics = topicRows.filter((t) => t.status === 'completed').length;
	const decided = planRows.filter((p) => p.status !== 'active');

	return {
		minutesTotal: sessionAgg?.total ?? 0,
		minutesLast7: last7.reduce((sum, r) => sum + r.minutes, 0),
		activeDaysLast30: last30.filter((r) => r.minutes > 0).length,
		sessionsLast30: minutesRows.filter((r) => last30.some((d) => d.day === r.day)).length,
		topicCompletion: { completed: completedTopics, total: topicRows.length, percent: pct(completedTopics, topicRows.length) },
		assessmentAverage: attempts.length > 0 ? Math.round(attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length) : null,
		assessmentCount: attempts.length,
		streakWeeks: last30.filter((r) => r.minutes > 0).length >= 5 ? Math.floor(last30.filter((r) => r.minutes > 0).length / 5) : 0,
		planAdherence: decided.length > 0 ? pct(decided.filter((p) => p.status === 'completed').length, decided.length) : null,
		projectsCompleted: projectAgg?.done ?? 0,
		notesCount: noteAgg?.total ?? 0,
		weakCount: weak.length,
		dueCount: revision.filter((r) => r.state === 'due').length,
		domainBreakdown: [...domains.entries()]
			.map(([domain, v]) => ({ domain, completed: v.completed, total: v.total, percent: pct(v.completed, v.total) }))
			.sort((a, b) => b.total - a.total)
	};
}

/** Deterministic diagnosis used when AI is disabled or fails. */
export function fallbackInsight(stats: LearningStats, weak: { title: string; mastery: number; reasons: string[] }[], revision: { title: string; state: string; overdueDays: number }[]): Insight {
	const observations: string[] = [];
	const actions: { title: string; detail: string; minutes: number }[] = [];

	if (stats.activeDaysLast30 === 0) {
		observations.push('No study sessions recorded yet, so there is nothing to diagnose.');
		actions.push({ title: 'Complete one session', detail: 'Finish a single item from today’s plan to establish a baseline.', minutes: 15 });
	} else {
		observations.push(`${stats.activeDaysLast30} active days in the last 30, averaging ${Math.round(stats.minutesLast7 / 7)} min per day this week.`);
	}
	if (stats.topicCompletion.percent > 0) observations.push(`${stats.topicCompletion.completed} of ${stats.topicCompletion.total} roadmap topics are complete (${stats.topicCompletion.percent}%).`);
	if (stats.planAdherence !== null && stats.planAdherence < 60) observations.push(`Only ${stats.planAdherence}% of finished daily plans were completed in full — the daily budget may be too ambitious.`);
	if (stats.assessmentAverage !== null) observations.push(`Assessment average is ${stats.assessmentAverage}% across ${stats.assessmentCount} attempts.`);
	const due = revision.filter((r) => r.state === 'due');
	if (due.length > 0) observations.push(`${due.length} topic${due.length === 1 ? '' : 's'} are past their review date, the highest being ${due[0].title}.`);
	if (weak.length > 0) observations.push(`Lowest retention: ${weak.slice(0, 3).map((w) => `${w.title} (${w.mastery}%)`).join(', ')}.`);

	if (due.length > 0) actions.push({ title: `Revise ${due[0].title}`, detail: 'Redo one practice item, then explain the idea aloud.', minutes: 15 });
	if (weak.length > 0) actions.push({ title: `Re-test ${weak[0].title}`, detail: 'Take the topic assessment again once you have reviewed the concept list.', minutes: 20 });
	if (stats.planAdherence !== null && stats.planAdherence < 60) actions.push({ title: 'Reduce your daily budget', detail: 'Lower your daily minutes in settings so the plan matches the time you actually have.', minutes: 5 });
	if (actions.length < 3 && stats.projectsCompleted === 0) actions.push({ title: 'Advance your project', detail: 'Finish the next milestone so the theory has something to attach to.', minutes: 30 });

	return {
		headline:
			stats.activeDaysLast30 === 0
				? 'Not enough data yet'
				: stats.assessmentAverage === null
					? 'Progress is being logged, but nothing is measured yet'
					: `Consistent work, ${stats.assessmentAverage >= 80 ? 'strong' : 'uneven'} recall`,
		observations: observations.slice(0, 5),
		actions: actions.slice(0, 3),
		focusTopic: weak[0]?.title ?? due[0]?.title ?? null,
		generated: false
	};
}

/** Raw history handed to the AI insight prompt. */
export async function insightInput(userId: string, today: string) {
	const [weak, revision, stats, checkInRows, attemptRows] = await Promise.all([
		weakTopics(userId, 8),
		revisionQueue(userId, today),
		learningStats(userId, today),
		db.select().from(checkIns).where(eq(checkIns.userId, userId)).orderBy(desc(checkIns.day)).limit(10),
		db
			.select({ title: assessments.title, score: assessmentAttempts.score, passed: assessmentAttempts.passed, summary: assessmentAttempts.summary })
			.from(assessmentAttempts)
			.innerJoin(assessments, eq(assessments.id, assessmentAttempts.assessmentId))
			.where(eq(assessmentAttempts.userId, userId))
			.orderBy(desc(assessmentAttempts.createdAt))
			.limit(10)
	]);
	return { weak, revision, stats, checkInRows, attemptRows };
}

export { subjectsMerge };
function subjectsMerge(a: string[], b: string[]) {
	return [...new Set([...a, ...b])];
}

void clamp;
void gte;
void inArray;
void assessmentQuestions;
void dailyPlanItems;
void roadmapPhases;
void roadmaps;
