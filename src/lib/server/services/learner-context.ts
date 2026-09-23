import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { addDaysISO, clamp, humanMinutes, pct } from '$lib/utils';
import { db } from '../db';
import {
	aiMemory,
	assessmentAttempts,
	assessments,
	checkIns,
	learningSessions,
	profiles,
	projectProgress,
	projects,
	topicProgress,
	topics
} from '../db/schema';
import type { TopicSnapshot } from '../engine/types';
import { getPreferences, getPrimaryGoal, getRoadmapBundle, memoryFor } from './access';
import { revisionQueue, roadmapProgress } from './progress';

export type LearnerContext = {
	name: string;
	level: string;
	learningStyle: string;
	dailyMinutes: number;
	targetRole: string | null;
	deadline: string | null;
	intensity: number;
	mentorAnswerStyle: 'guided' | 'direct';
	goal: { id: string; title: string } | null;
	roadmap: {
		totalTopics: number;
		completed: number;
		inProgress: number;
		percent: number;
		estimatedMinutesRemaining: number;
		phases: { title: string; completed: number; total: number }[];
	} | null;
	currentTopic: {
		topicId: string;
		title: string;
		domain: string;
		concepts: string[];
		difficulty: number;
		progressPct: number;
		phaseTitle: string;
	} | null;
	recentTopics: { title: string; status: string; mastery: number; minutesSpent: number }[];
	upcomingTopics: { title: string; difficulty: number; estimatedMinutes: number }[];
	dueRevision: { title: string; mastery: number; overdueDays: number }[];
	weakAreas: { title: string; mastery: number; note: string }[];
	strengths: { title: string; mastery: number }[];
	assessmentHistory: { title: string; score: number; passed: boolean; at: string; weak: string[] }[];
	recentCheckIns: {
		day: string;
		completed: string;
		minutes: number;
		difficulty: number;
		confidence: number;
		blockers: string[];
		tomorrow: string;
	}[];
	studyPattern: { last7Minutes: number; activeDaysLast7: number; averageSessionMinutes: number };
	project: { title: string; goal: string; done: number; total: number; nextMilestone: string | null } | null;
	memory: { kind: string; content: string; timesObserved: number }[];
};

/**
 * Assembles everything the AI needs to behave like a tutor who already knows
 * this learner. Only non-sensitive learning data is included.
 */
export async function buildLearnerContext(userId: string, today: string): Promise<LearnerContext | null> {
	const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
	if (!profile) return null;
	const prefs = await getPreferences(userId);
	const goal = await getPrimaryGoal(userId);
	const bundle = await getRoadmapBundle(userId, goal?.id ?? null);
	const progress = await roadmapProgress(userId, goal?.id ?? null);
	const snapshots = bundle?.topics ?? [];

	const topicIds = snapshots.map((t) => t.topicId);
	const conceptByTopic = new Map<string, { title: string; concepts: string[]; difficulty: number }>();
	if (bundle) {
		const rows = await db
			.select({ id: topics.id, title: topics.title, concepts: topics.concepts, difficulty: topics.difficulty })
			.from(topics)
			.where(inArray(topics.id, topicIds));
		for (const row of rows) conceptByTopic.set(row.id, { title: row.title, concepts: row.concepts, difficulty: row.difficulty });
	}

	const current =
		snapshots.find((t) => t.status === 'in_progress') ?? snapshots.find((t) => t.available && t.status === 'not_started') ?? null;

	const [attemptRows, checkInRows, sessionStats, memories, revision] = await Promise.all([
		db
			.select({
				title: assessments.title,
				score: assessmentAttempts.score,
				passed: assessmentAttempts.passed,
				at: assessmentAttempts.createdAt,
				summary: assessmentAttempts.summary
			})
			.from(assessmentAttempts)
			.innerJoin(assessments, eq(assessments.id, assessmentAttempts.assessmentId))
			.where(eq(assessmentAttempts.userId, userId))
			.orderBy(desc(assessmentAttempts.createdAt))
			.limit(8),
		db.select().from(checkIns).where(eq(checkIns.userId, userId)).orderBy(desc(checkIns.day)).limit(7),
		db
			.select({ minutes: learningSessions.minutes, day: learningSessions.day, kind: learningSessions.kind })
			.from(learningSessions)
			.where(and(eq(learningSessions.userId, userId), sql`${learningSessions.day} >= ${addDaysISO(today, -6)}`)),
		memoryFor(userId, 30),
		revisionQueue(userId, today)
	]);

	const last7Minutes = sessionStats.reduce((sum, s) => sum + s.minutes, 0);
	const activeDaysLast7 = new Set(sessionStats.map((s) => s.day)).size;
	const averageSessionMinutes = sessionStats.length > 0 ? Math.round(last7Minutes / sessionStats.length) : 0;

	const byMastery = [...snapshots].filter((t) => t.mastery > 0).sort((a, b) => b.mastery - a.mastery);

	const activeProject = await (async () => {
		if (!bundle || bundle.projectList.length === 0) return null;
		const ids = bundle.projectList.map((p) => p.id);
		const states = await db.select().from(projectProgress).where(inArray(projectProgress.projectId, ids));
		const byId = new Map(states.map((s) => [s.projectId, s]));
		const chosen =
			bundle.projectList.find((p) => (byId.get(p.id)?.status ?? 'not_started') === 'in_progress') ?? bundle.projectList[0];
		if (!chosen) return null;
		const done = byId.get(chosen.id)?.completedMilestones.length ?? 0;
		return {
			title: chosen.title,
			goal: chosen.goal,
			done,
			total: chosen.milestones.length,
			nextMilestone: chosen.milestones[done]?.title ?? null
		};
	})();

	return {
		name: profile.displayName,
		level: profile.level,
		learningStyle: profile.learningStyle,
		dailyMinutes: profile.dailyMinutes,
		targetRole: profile.targetRole,
		deadline: profile.deadline,
		intensity: prefs.intensity,
		mentorAnswerStyle: prefs.mentorAnswerStyle,
		goal: goal ? { id: goal.id, title: goal.title } : null,
		roadmap: progress
			? {
					totalTopics: progress.total,
					completed: progress.completed,
					inProgress: progress.inProgress,
					percent: progress.percent,
					estimatedMinutesRemaining: progress.estimatedMinutesRemaining,
					phases: progress.phases.map((p) => ({ title: p.title, completed: p.completed, total: p.total }))
				}
			: null,
		currentTopic: current
			? {
					topicId: current.topicId,
					title: current.title,
					domain: current.domain,
					concepts: conceptByTopic.get(current.topicId)?.concepts ?? [],
					difficulty: current.difficulty,
					progressPct: current.progressPct,
					phaseTitle: current.phaseTitle
				}
			: null,
		recentTopics: snapshots
			.filter((t) => t.status !== 'not_started')
			.sort((a, b) => (b.lastReviewedAt?.getTime() ?? 0) - (a.lastReviewedAt?.getTime() ?? 0))
			.slice(0, 10)
			.map((t) => ({ title: t.title, status: t.status, mastery: t.mastery, minutesSpent: t.minutesSpent })),
		upcomingTopics: snapshots
			.filter((t) => t.status === 'not_started' && t.available)
			.slice(0, 6)
			.map((t) => ({ title: t.title, difficulty: t.difficulty, estimatedMinutes: t.estimatedMinutes })),
		dueRevision: revision.slice(0, 6).map((r) => ({ title: r.title, mastery: r.mastery, overdueDays: r.overdueDays })),
		weakAreas: byMastery
			.filter((t) => t.mastery < 70)
			.sort((a, b) => a.mastery - b.mastery)
			.slice(0, 6)
			.map((t) => ({
				title: t.title,
				mastery: t.mastery,
				note: t.status === 'in_progress' ? `${t.progressPct}% through the topic` : 'Attempted'
			})),
		strengths: byMastery
			.filter((t) => t.mastery >= 80)
			.slice(0, 6)
			.map((t) => ({ title: t.title, mastery: t.mastery })),
		assessmentHistory: attemptRows.map((row) => {
			const summary = row.summary as { weak?: string[] } | null;
			return {
				title: row.title,
				score: row.score,
				passed: row.passed,
				at: row.at.toISOString().slice(0, 10),
				weak: summary?.weak?.slice(0, 3) ?? []
			};
		}),
		recentCheckIns: checkInRows.map((c) => ({
			day: c.day,
			completed: c.completedPlan,
			minutes: c.minutesStudied,
			difficulty: c.difficulty,
			confidence: c.confidence,
			blockers: c.blockers,
			tomorrow: c.tomorrow
		})),
		studyPattern: { last7Minutes, activeDaysLast7, averageSessionMinutes },
		project: activeProject,
		memory: memories.map((m) => ({ kind: m.kind, content: m.content, timesObserved: m.timesObserved }))
	};
}

/** Renders the learner context as a compact system prompt block. */
export function contextToPrompt(ctx: LearnerContext, extras?: string): string {
	const lines: string[] = [];
	lines.push(
		`LEARNER: ${ctx.name} · level ${ctx.level} · studies ~${ctx.dailyMinutes} min/day · prefers ${ctx.learningStyle.replace('_', ' ')} material.`
	);
	if (ctx.targetRole) lines.push(`TARGET ROLE: ${ctx.targetRole}${ctx.deadline ? ` · deadline ${ctx.deadline}` : ''}`);
	if (ctx.goal) lines.push(`PRIMARY GOAL: ${ctx.goal.title}`);
	if (ctx.roadmap) {
		lines.push(
			`ROADMAP: ${ctx.roadmap.completed}/${ctx.roadmap.totalTopics} topics complete (${ctx.roadmap.percent}%), ~${humanMinutes(ctx.roadmap.estimatedMinutesRemaining)} of work left.`
		);
		lines.push(`PHASES: ${ctx.roadmap.phases.map((p) => `${p.title} ${p.completed}/${p.total}`).join(' · ')}`);
	}
	if (ctx.currentTopic) {
		lines.push(
			`CURRENT TOPIC: ${ctx.currentTopic.title} (${ctx.currentTopic.phaseTitle}, difficulty ${ctx.currentTopic.difficulty}/5, ${ctx.currentTopic.progressPct}% done). Concepts: ${ctx.currentTopic.concepts.join(', ') || 'n/a'}.`
		);
	}
	if (ctx.recentTopics.length > 0)
		lines.push(
			`RECENTLY WORKED ON: ${ctx.recentTopics.map((t) => `${t.title} (${t.status}, mastery ${t.mastery}%)`).join('; ')}`
		);
	if (ctx.upcomingTopics.length > 0)
		lines.push(
			`UP NEXT: ${ctx.upcomingTopics.map((t) => `${t.title} (difficulty ${t.difficulty}, ~${humanMinutes(t.estimatedMinutes)})`).join('; ')}`
		);
	if (ctx.dueRevision.length > 0)
		lines.push(
			`REVISION DUE: ${ctx.dueRevision.map((r) => `${r.title} (mastery ${r.mastery}%${r.overdueDays > 0 ? `, ${r.overdueDays}d overdue` : ''})`).join('; ')}`
		);
	if (ctx.weakAreas.length > 0)
		lines.push(`WEAK AREAS: ${ctx.weakAreas.map((w) => `${w.title} (mastery ${w.mastery}%, ${w.note})`).join('; ')}`);
	if (ctx.strengths.length > 0) lines.push(`STRENGTHS: ${ctx.strengths.map((s) => `${s.title} (${s.mastery}%)`).join('; ')}`);
	if (ctx.assessmentHistory.length > 0)
		lines.push(
			`ASSESSMENTS: ${ctx.assessmentHistory.map((a) => `${a.title} ${a.score}% ${a.passed ? 'passed' : 'failed'}${a.weak.length ? ` (weak: ${a.weak.join(', ')})` : ''}`).join('; ')}`
		);
	if (ctx.recentCheckIns.length > 0)
		lines.push(
			`CHECK-INS: ${ctx.recentCheckIns.map((c) => `${c.day}: ${c.completed}, ${c.minutes}min, difficulty ${c.difficulty}/5, confidence ${c.confidence}/5${c.blockers.length ? `, blocked by ${c.blockers.join('/')}` : ''}`).join('; ')}`
		);
	lines.push(
		`STUDY PATTERN: ${ctx.studyPattern.last7Minutes} min over ${ctx.studyPattern.activeDaysLast7}/7 days, average session ${ctx.studyPattern.averageSessionMinutes} min.`
	);
	if (ctx.project)
		lines.push(
			`PROJECT: ${ctx.project.title} — ${ctx.project.goal} (${ctx.project.done}/${ctx.project.total} milestones${ctx.project.nextMilestone ? `, next: ${ctx.project.nextMilestone}` : ''}).`
		);
	if (ctx.memory.length > 0)
		lines.push(`REMEMBERED ABOUT THIS LEARNER: ${ctx.memory.map((m) => `[${m.kind}] ${m.content}`).join(' | ')}`);
	if (extras) lines.push(extras);
	return lines.join('\n');
}

/** Persists a durable learning fact, incrementing evidence when it repeats. */
export async function rememberFact(input: {
	userId: string;
	kind: 'strength' | 'weakness' | 'preference' | 'mistake' | 'skill' | 'goal' | 'project_context';
	key: string;
	content: string;
	topicId?: string | null;
	source: 'assessment' | 'check_in' | 'mentor' | 'onboarding' | 'progress';
	confidence?: number;
}) {
	const key = input.key.slice(0, 160);
	const [existing] = await db
		.select()
		.from(aiMemory)
		.where(and(eq(aiMemory.userId, input.userId), eq(aiMemory.kind, input.kind), eq(aiMemory.key, key)))
		.limit(1);

	if (existing) {
		await db
			.update(aiMemory)
			.set({
				content: input.content,
				timesObserved: existing.timesObserved + 1,
				confidence: clamp(Math.max(existing.confidence, input.confidence ?? 60), 0, 100),
				lastObservedAt: new Date(),
				resolvedAt: null
			})
			.where(eq(aiMemory.id, existing.id));
		return existing.id;
	}

	const [created] = await db
		.insert(aiMemory)
		.values({
			userId: input.userId,
			kind: input.kind,
			key,
			content: input.content,
			topicId: input.topicId ?? null,
			source: input.source,
			confidence: input.confidence ?? 60
		})
		.returning({ id: aiMemory.id });
	return created.id;
}

/** Marks a weakness as resolved once the learner demonstrably improves. */
export async function resolveMemory(userId: string, kind: string, keyLike: string) {
	await db
		.update(aiMemory)
		.set({ resolvedAt: new Date() })
		.where(and(eq(aiMemory.userId, userId), eq(aiMemory.kind, kind as 'weakness'), sql`${aiMemory.key} like ${`%${keyLike}%`}`));
}

export { pct };
