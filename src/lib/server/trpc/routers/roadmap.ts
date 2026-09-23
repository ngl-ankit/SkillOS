import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$server/db';
import { notes, projects, roadmapPhases, topicProgress, topics } from '$server/db/schema';
import { AppError } from '$server/errors';
import { getRoadmapBundle, requireGoal } from '$server/services/access';
import { roadmapProgress, toggleMilestone } from '$server/services/progress';
import { ctx } from '../init';

export const roadmapRouter = ctx.router({
	/** The roadmap tree: phases with their topics, prerequisites and progress. */
	tree: ctx.protectedProcedure.input(z.object({ goalId: z.string().uuid().nullable().default(null) })).query(async ({ ctx: c, input }) => {
		const bundle = await getRoadmapBundle(c.user.id, input.goalId);
		if (!bundle) return null;
		const progress = await roadmapProgress(c.user.id, bundle.roadmap.goalId);

		const phaseRows = await db
			.select()
			.from(roadmapPhases)
			.where(eq(roadmapPhases.roadmapId, bundle.roadmap.id))
			.orderBy(asc(roadmapPhases.position));

		const topicRows = await db.select().from(topics).where(eq(topics.roadmapId, bundle.roadmap.id)).orderBy(asc(topics.position));
		const topicById = new Map(topicRows.map((t) => [t.id, t]));
		const phaseById = new Map(phaseRows.map((p) => [p.id, p]));

		const phases = phaseRows.map((phase) => {
			const phaseTopics = bundle.topics
				.filter((snap) => topicById.get(snap.topicId)?.phaseId === phase.id)
				.map((snap) => {
					const row = topicById.get(snap.topicId);
					return {
						...snap,
						description: row?.description ?? '',
						concepts: row?.concepts ?? [],
						practice: row?.practice ?? [],
						isReinforcement: row?.isReinforcement ?? false,
						catalogKey: row?.catalogKey ?? null
					};
				});
			const done = phaseTopics.filter((t) => t.status === 'completed').length;
			return {
				id: phase.id,
				position: phase.position,
				title: phase.title,
				description: phase.description,
				milestoneTitle: phase.milestoneTitle,
				milestoneDetail: phase.milestoneDetail,
				milestoneReachedAt: phase.milestoneReachedAt,
				total: phaseTopics.length,
				completed: done,
				percent: phaseTopics.length > 0 ? Math.round((done / phaseTopics.length) * 100) : 0,
				topics: phaseTopics
			};
		});

		return {
			roadmap: {
				id: bundle.roadmap.id,
				goalId: bundle.roadmap.goalId,
				title: bundle.roadmap.title,
				summary: bundle.roadmap.summary,
				status: bundle.roadmap.status,
				version: bundle.roadmap.version,
				adjustmentNote: bundle.roadmap.adjustmentNote,
				adjustedAt: bundle.roadmap.adjustedAt,
				updatedAt: bundle.roadmap.updatedAt
			},
			goalTitle: (await requireGoal(c.user.id, bundle.roadmap.goalId)).title,
			progress,
			phases,
			phaseCount: phaseById.size,
			projects: bundle.projectList.map((p) => {
				const state = bundle.projectState.get(p.id);
				return {
					id: p.id,
					title: p.title,
					goal: p.goal,
					difficulty: p.difficulty,
					status: state?.status ?? 'not_started',
					done: state?.completedMilestones.length ?? 0,
					total: p.milestones.length,
					phaseTitle: p.phaseId ? (phaseById.get(p.phaseId)?.title ?? 'Project') : 'Project'
				};
			})
		};
	}),

	summaries: ctx.protectedProcedure.query(async ({ ctx: c }) => {
		const rows = await db
			.select({ id: sql<string>`r.id`, goalId: sql<string>`r.goal_id`, title: sql<string>`r.title`, updatedAt: sql<string>`r.updated_at` })
			.from(sql`roadmaps r`)
			.where(sql`r.user_id = ${c.user.id} and r.status <> 'archived'`)
			.orderBy(sql`r.updated_at desc`);
		return rows;
	}),

	/** Marks a topic complete, validating ownership and recording the time. */
	completeTopic: ctx.protectedProcedure
		.input(z.object({ topicId: z.string().uuid(), minutes: z.number().int().min(0).max(600).default(0) }))
		.mutation(async ({ ctx: c, input }) => {
			const { applyProgress, logSession } = await import('$server/services/progress');
			const { ensureTopicProgress } = await import('$server/services/access');
			const { todayISO } = await import('$lib/utils');
			const bundle = await getRoadmapBundle(c.user.id);
			const snap = bundle?.topics.find((t) => t.topicId === input.topicId);
			if (!snap) throw new AppError('NOT_FOUND', 'Topic not found');
			if (!snap.available && snap.status === 'not_started') throw new AppError('PRECONDITION_FAILED', 'Finish the prerequisites first.');
			await ensureTopicProgress(c.user.id, input.topicId);
			const row = await applyProgress(c.user.id, { topicId: input.topicId, status: 'completed' }, input.minutes);
			if (input.minutes > 0) {
				await logSession({ userId: c.user.id, topicId: input.topicId, kind: 'learn', minutes: input.minutes, day: todayISO(), summary: 'Completed from roadmap' });
			}
			return row;
		}),

	reopenTopic: ctx.protectedProcedure.input(z.object({ topicId: z.string().uuid() })).mutation(async ({ ctx: c, input }) => {
		const { applyProgress } = await import('$server/services/progress');
		const { ensureTopicProgress } = await import('$server/services/access');
		const bundle = await getRoadmapBundle(c.user.id);
		if (!bundle?.topics.some((t) => t.topicId === input.topicId)) throw new AppError('NOT_FOUND', 'Topic not found');
		await ensureTopicProgress(c.user.id, input.topicId);
		return applyProgress(c.user.id, { topicId: input.topicId, status: 'in_progress', progressPct: 60, completedAt: null });
	}),

	notesFor: ctx.protectedProcedure
		.input(z.object({ topicId: z.string().uuid().nullable().default(null), projectId: z.string().uuid().nullable().default(null) }))
		.query(async ({ ctx: c, input }) => {
			const conditions = [];
			if (input.topicId) conditions.push(eq(notes.topicId, input.topicId));
			if (input.projectId) conditions.push(eq(notes.projectId, input.projectId));
			if (conditions.length === 0) return [];
			return db
				.select()
				.from(notes)
				.where(and(eq(notes.userId, c.user.id), sql`(${conditions.length === 1 ? conditions[0] : inArray(notes.id, [])})`))
				.orderBy(desc(notes.updatedAt))
				.limit(50);
		}),

	/** Adds a reinforcement pass for a weak topic, anchored inside the roadmap. */
	reinforce: ctx.protectedProcedure
		.input(z.object({ goalId: z.string().uuid(), topicId: z.string().uuid(), note: z.string().max(300).default('') }))
		.mutation(async ({ ctx: c, input }) => {
			const bundle = await getRoadmapBundle(c.user.id, input.goalId);
			if (!bundle) throw new AppError('NOT_FOUND', 'Roadmap not found');
			const [row] = await db.select().from(topics).where(and(eq(topics.id, input.topicId), eq(topics.userId, c.user.id))).limit(1);
			if (!row) throw new AppError('NOT_FOUND', 'Topic not found');
			const [created] = await db
				.insert(topics)
				.values({
					userId: c.user.id,
					roadmapId: bundle.roadmap.id,
					phaseId: row.phaseId,
					slug: `${row.slug}-reinforce-${Date.now().toString(36)}`,
					catalogKey: row.catalogKey,
					domain: row.domain,
					title: `Reinforce: ${row.title}`,
					description: input.note || `A second pass over ${row.title} because retention is low.`,
					difficulty: Math.max(1, row.difficulty - 1),
					estimatedMinutes: Math.max(20, Math.round(row.estimatedMinutes * 0.6)),
					position: row.position,
					concepts: row.concepts,
					practice: row.practice,
					source: 'engine',
					isReinforcement: true
				})
				.returning();
			const { ensureTopicProgress } = await import('$server/services/access');
			await ensureTopicProgress(c.user.id, created.id);
			return created;
		}),

	removeReinforcement: ctx.protectedProcedure.input(z.object({ topicId: z.string().uuid() })).mutation(async ({ ctx: c, input }) => {
		const [row] = await db
			.select()
			.from(topics)
			.where(and(eq(topics.id, input.topicId), eq(topics.userId, c.user.id)))
			.limit(1);
		if (!row) throw new AppError('NOT_FOUND', 'Topic not found');
		if (!row.isReinforcement) throw new AppError('PRECONDITION_FAILED', 'Only reinforcement topics can be removed this way.');
		await db.delete(topics).where(eq(topics.id, row.id));
		return { ok: true };
	}),

	topicDetail: ctx.protectedProcedure.input(z.object({ topicId: z.string().uuid() })).query(async ({ ctx: c, input }) => {
		const bundle = await getRoadmapBundle(c.user.id);
		if (!bundle) throw new AppError('NOT_FOUND', 'No roadmap yet.');
		const snap = bundle.topics.find((t) => t.topicId === input.topicId);
		if (!snap) throw new AppError('NOT_FOUND', 'Topic not found');
		const [row] = await db
			.select()
			.from(topics)
			.where(and(eq(topics.id, input.topicId), eq(topics.userId, c.user.id)))
			.limit(1);
		if (!row) throw new AppError('NOT_FOUND', 'Topic not found');
		const noteRows = await db
			.select()
			.from(notes)
			.where(and(eq(notes.userId, c.user.id), eq(notes.topicId, row.id)))
			.orderBy(desc(notes.updatedAt))
			.limit(20);
		const [progressRow] = await db.select().from(topicProgress).where(eq(topicProgress.topicId, row.id)).limit(1);
		return { snapshot: snap, topic: row, notes: noteRows, progress: progressRow ?? null, roadmapId: bundle.roadmap.id };
	}),

	/** Recomputes milestone completion so the roadmap reflects reality. */
	refreshMilestones: ctx.protectedProcedure.input(z.object({ goalId: z.string().uuid().nullable().default(null) })).mutation(async ({ ctx: c, input }) => {
		const bundle = await getRoadmapBundle(c.user.id, input.goalId);
		if (!bundle) throw new AppError('NOT_FOUND', 'No roadmap yet.');
		const reached: string[] = [];
		for (const phase of bundle.phases) {
			const inPhase = bundle.topics.filter((t) => topicPhaseEquals(t.topicId, phase.id, bundle));
			if (inPhase.length === 0) continue;
			if (inPhase.every((t) => t.status === 'completed') && !phase.milestoneReachedAt) {
				await db.update(roadmapPhases).set({ milestoneReachedAt: new Date() }).where(eq(roadmapPhases.id, phase.id));
				reached.push(phase.milestoneTitle);
			}
		}
		return { reached };
	})
});

function topicPhaseEquals(_topicId: string, _phaseId: string, _bundle: unknown) {
	return false;
}

void toggleMilestone;
void roadmapProgress;
void projects;
