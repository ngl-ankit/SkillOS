import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import {
	aiMemory,
	dailyPlanItems,
	dailyPlans,
	goals,
	learningSessions,
	profiles,
	projectProgress,
	projects,
	roadmapPhases,
	roadmaps,
	topicPrerequisites,
	topicProgress,
	topics,
	userPreferences
} from '../db/schema';
import { retention } from '../engine/srs';
import type { TopicSnapshot } from '../engine/types';
import { AppError } from '../errors';

export type Profile = typeof profiles.$inferSelect;
export type Preferences = typeof userPreferences.$inferSelect;
export type Goal = typeof goals.$inferSelect;

export async function getProfile(userId: string): Promise<Profile | null> {
	const [row] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
	return row ?? null;
}

export async function requireProfile(userId: string): Promise<Profile> {
	const profile = await getProfile(userId);
	if (!profile) throw new AppError('PRECONDITION_FAILED', 'Finish onboarding to continue.');
	return profile;
}

export async function getPreferences(userId: string): Promise<Preferences> {
	const [row] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
	if (row) return row;
	const [created] = await db.insert(userPreferences).values({ userId }).onConflictDoNothing().returning();
	return (
		created ?? {
			userId,
			universeMode: 'auto',
			reducedMotion: false,
			reminderHour: 18,
			notificationsEnabled: true,
			intensity: 100,
			mentorAnswerStyle: 'guided',
			updatedAt: new Date()
		}
	);
}

export async function isOnboarded(userId: string): Promise<boolean> {
	const profile = await getProfile(userId);
	return Boolean(profile?.onboardedAt);
}

export async function listGoals(userId: string, includeArchived = false): Promise<Goal[]> {
	const rows = await db
		.select()
		.from(goals)
		.where(includeArchived ? eq(goals.userId, userId) : and(eq(goals.userId, userId), sql`${goals.status} <> 'archived'`))
		.orderBy(desc(goals.isPrimary), desc(goals.createdAt));
	return rows;
}

export async function getPrimaryGoal(userId: string): Promise<Goal | null> {
	const [row] = await db
		.select()
		.from(goals)
		.where(and(eq(goals.userId, userId), eq(goals.status, 'active')))
		.orderBy(desc(goals.isPrimary), desc(goals.createdAt))
		.limit(1);
	return row ?? null;
}

export async function requireGoal(userId: string, goalId: string): Promise<Goal> {
	const [row] = await db
		.select()
		.from(goals)
		.where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
		.limit(1);
	if (!row) throw new AppError('NOT_FOUND', 'Goal not found');
	return row;
}

export type RoadmapBundle = {
	roadmap: typeof roadmaps.$inferSelect;
	phases: (typeof roadmapPhases.$inferSelect)[];
	topics: TopicSnapshot[];
	projectList: (typeof projects.$inferSelect)[];
	projectState: Map<string, typeof projectProgress.$inferSelect>;
};

/** Loads the active roadmap for a goal with every topic's progress attached. */
export async function getRoadmapBundle(userId: string, goalId?: string | null): Promise<RoadmapBundle | null> {
	const goal = goalId ? await requireGoal(userId, goalId) : await getPrimaryGoal(userId);
	if (!goal) return null;

	const [roadmap] = await db
		.select()
		.from(roadmaps)
		.where(and(eq(roadmaps.userId, userId), eq(roadmaps.goalId, goal.id), sql`${roadmaps.status} <> 'archived'`))
		.orderBy(desc(roadmaps.version))
		.limit(1);
	if (!roadmap) return null;

	const phases = await db
		.select()
		.from(roadmapPhases)
		.where(eq(roadmapPhases.roadmapId, roadmap.id))
		.orderBy(asc(roadmapPhases.position));
	const topicRows = await db.select().from(topics).where(eq(topics.roadmapId, roadmap.id)).orderBy(asc(topics.position));

	const topicIds = topicRows.map((t) => t.id);
	const [progressRows, edgeRows, projectRows] = await Promise.all([
		topicIds.length > 0 ? db.select().from(topicProgress).where(inArray(topicProgress.topicId, topicIds)) : Promise.resolve([]),
		topicIds.length > 0
			? db.select().from(topicPrerequisites).where(inArray(topicPrerequisites.topicId, topicIds))
			: Promise.resolve([]),
		db
			.select()
			.from(projects)
			.where(and(eq(projects.userId, userId), eq(projects.roadmapId, roadmap.id)))
	]);

	const projectIds = projectRows.map((p) => p.id);
	const projectState = new Map<string, typeof projectProgress.$inferSelect>();
	if (projectIds.length > 0) {
		for (const row of await db.select().from(projectProgress).where(inArray(projectProgress.projectId, projectIds))) {
			projectState.set(row.projectId, row);
		}
	}

	const progressByTopic = new Map(progressRows.map((p) => [p.topicId, p]));
	const titleById = new Map(topicRows.map((t) => [t.id, t.title]));
	const phaseTitle = new Map(phases.map((p) => [p.id, p.title]));

	const prereqsByTopic = new Map<string, string[]>();
	for (const edge of edgeRows) {
		const list = prereqsByTopic.get(edge.topicId) ?? [];
		list.push(edge.prerequisiteId);
		prereqsByTopic.set(edge.topicId, list);
	}

	const orderedTopics = [...topicRows].sort(
		(a, b) => phases.findIndex((p) => p.id === a.phaseId) - phases.findIndex((p) => p.id === b.phaseId) || a.position - b.position
	);

	const completedIds = new Set(orderedTopics.filter((t) => progressByTopic.get(t.id)?.status === 'completed').map((t) => t.id));

	const snapshots: TopicSnapshot[] = orderedTopics.map((topic) => {
		const progress = progressByTopic.get(topic.id);
		const prereqIds = prereqsByTopic.get(topic.id) ?? [];
		const status = progress?.status ?? 'not_started';
		// A topic unlocks when every prerequisite is completed. Prior-knowledge topics skip the gate.
		const available =
			status !== 'not_started' || progress?.priorKnowledge === true || prereqIds.every((id) => completedIds.has(id));
		return {
			topicId: topic.id,
			title: topic.title,
			domain: topic.domain,
			difficulty: topic.difficulty,
			estimatedMinutes: topic.estimatedMinutes,
			position: topic.position,
			phaseTitle: phaseTitle.get(topic.phaseId) ?? 'Phase',
			status,
			progressPct: progress?.progressPct ?? 0,
			mastery: retention({
				mastery: progress?.mastery ?? 0,
				reviewCount: progress?.reviewCount ?? 0,
				lastReviewedAt: progress?.lastReviewedAt ?? null
			}),
			minutesSpent: progress?.minutesSpent ?? 0,
			prerequisites: prereqIds,
			prerequisiteTitles: prereqIds.map((id) => titleById.get(id) ?? 'Unknown topic'),
			available,
			nextReviewAt: progress?.nextReviewAt ?? null,
			intervalDays: progress?.intervalDays ?? 0,
			easeFactor: progress?.easeFactor ?? 2.4,
			reviewCount: progress?.reviewCount ?? 0,
			lastReviewedAt: progress?.lastReviewedAt ?? null
		};
	});

	return { roadmap, phases, topics: snapshots, projectList: projectRows, projectState };
}

export async function requireTopic(userId: string, topicId: string) {
	const [row] = await db
		.select()
		.from(topics)
		.where(and(eq(topics.id, topicId), eq(topics.userId, userId)))
		.limit(1);
	if (!row) throw new AppError('NOT_FOUND', 'Topic not found');
	return row;
}

export async function getTopicProgress(userId: string, topicId: string) {
	const [row] = await db
		.select()
		.from(topicProgress)
		.where(and(eq(topicProgress.topicId, topicId), eq(topicProgress.userId, userId)))
		.limit(1);
	return row ?? null;
}

export async function ensureTopicProgress(userId: string, topicId: string) {
	const existing = await getTopicProgress(userId, topicId);
	if (existing) return existing;
	const [created] = await db.insert(topicProgress).values({ userId, topicId }).onConflictDoNothing().returning();
	if (created) return created;
	const refetched = await getTopicProgress(userId, topicId);
	if (!refetched) throw new AppError('CONFLICT', 'Could not initialise topic progress');
	return refetched;
}

export async function todayPlan(userId: string, day: string) {
	const [plan] = await db
		.select()
		.from(dailyPlans)
		.where(and(eq(dailyPlans.userId, userId), eq(dailyPlans.day, day)))
		.limit(1);
	if (!plan) return null;
	const items = await db
		.select()
		.from(dailyPlanItems)
		.where(eq(dailyPlanItems.planId, plan.id))
		.orderBy(asc(dailyPlanItems.position));
	return { plan, items };
}

export async function recentSessions(userId: string, limit = 30) {
	return db
		.select()
		.from(learningSessions)
		.where(eq(learningSessions.userId, userId))
		.orderBy(desc(learningSessions.createdAt))
		.limit(limit);
}

export async function memoryFor(userId: string, limit = 40) {
	return db
		.select()
		.from(aiMemory)
		.where(and(eq(aiMemory.userId, userId), sql`${aiMemory.resolvedAt} is null`))
		.orderBy(desc(aiMemory.lastObservedAt))
		.limit(limit);
}
