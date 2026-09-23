import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { humanMinutes, todayISO } from '$lib/utils';
import { db } from '$server/db';
import { learningSessions, notes, projectProgress, projects, topicProgress, topics } from '$server/db/schema';
import { AppError } from '$server/errors';
import { getRoadmapBundle } from '$server/services/access';
import { roadmapProgress, toggleMilestone } from '$server/services/progress';
import { ctx } from '../init';

export const projectsRouter = ctx.router({
	/** All roadmap projects with live milestone state. */
	list: ctx.protectedProcedure.query(async ({ ctx: c }) => {
		const bundle = await getRoadmapBundle(c.user.id);
		if (!bundle) return [];
		const ids = bundle.projectList.map((p) => p.id);
		const states = ids.length > 0 ? await db.select().from(projectProgress).where(inArray(projectProgress.projectId, ids)) : [];
		const byId = new Map(states.map((s) => [s.projectId, s]));

		const sessionsByProject = await db
			.select({ projectId: sql<string>`project_id`, minutes: sql<number>`sum(minutes)::int` })
			.from(sql`learning_sessions`)
			.where(sql`user_id = ${c.user.id} and kind = 'project'`)
			.groupBy(sql`project_id`);
		const minutesById = new Map(sessionsByProject.filter((r) => r.projectId).map((r) => [r.projectId, r.minutes]));

		const noteCounts = await db
			.select({ projectId: notes.projectId, total: sql<number>`count(*)::int` })
			.from(notes)
			.where(and(eq(notes.userId, c.user.id), sql`${notes.projectId} is not null`))
			.groupBy(notes.projectId);
		const notesById = new Map(noteCounts.filter((r) => r.projectId).map((r) => [r.projectId as string, r.total]));

		return bundle.projectList
			.map((project) => {
				const state = byId.get(project.id);
				const done = state?.completedMilestones.length ?? 0;
				return {
					id: project.id,
					title: project.title,
					goal: project.goal,
					difficulty: project.difficulty,
					concepts: project.concepts,
					requirements: project.requirements.length,
					suggestedStack: project.suggestedStack,
					estimatedHours: project.estimatedHours,
					status: state?.status ?? 'not_started',
					done,
					total: project.milestones.length,
					percent: project.milestones.length > 0 ? Math.round((done / project.milestones.length) * 100) : 0,
					nextMilestone: project.milestones[done]?.title ?? null,
					minutesLogged: minutesById.get(project.id) ?? 0,
					notes: notesById.get(project.id) ?? 0,
					updatedAt: state?.updatedAt ?? null,
					topicId: project.topicId
				};
			})
			.sort((a, b) => {
				const rank = (s: string) => (s === 'in_progress' ? 0 : s === 'not_started' ? 1 : 2);
				return rank(a.status) - rank(b.status) || a.difficulty - b.difficulty;
			});
	}),

	detail: ctx.protectedProcedure.input(z.object({ projectId: z.string().uuid() })).query(async ({ ctx: c, input }) => {
		const [project] = await db
			.select()
			.from(projects)
			.where(and(eq(projects.id, input.projectId), eq(projects.userId, c.user.id)))
			.limit(1);
		if (!project) throw new AppError('NOT_FOUND', 'Project not found');

		const [state] = await db.select().from(projectProgress).where(eq(projectProgress.projectId, project.id)).limit(1);
		const done = state?.completedMilestones.length ?? 0;

		const noteRows = await db
			.select()
			.from(notes)
			.where(and(eq(notes.userId, c.user.id), eq(notes.projectId, project.id)))
			.orderBy(desc(notes.updatedAt))
			.limit(30);

		const [minutes] = await db
			.select({ total: sql<number>`coalesce(sum(${learningSessions.minutes}), 0)::int` })
			.from(learningSessions)
			.where(and(eq(learningSessions.userId, c.user.id), eq(learningSessions.kind, 'project')));

		const anchor = project.topicId
			? (await db.select({ id: topics.id, title: topics.title }).from(topics).where(eq(topics.id, project.topicId)).limit(1))[0]
			: null;

		return {
			project,
			progress: {
				status: state?.status ?? 'not_started',
				completedMilestones: state?.completedMilestones ?? [],
				repoUrl: state?.repoUrl ?? null,
				reflection: state?.reflection ?? null,
				startedAt: state?.startedAt ?? null,
				completedAt: state?.completedAt ?? null
			},
			nextMilestone: project.milestones[done] ?? null,
			percent: project.milestones.length > 0 ? Math.round((done / project.milestones.length) * 100) : 0,
			notes: noteRows,
			minutesLogged: minutes?.total ?? 0,
			anchorTopic: anchor
		};
	}),

	/** Toggles a milestone; milestones must be completed in order. */
	setMilestone: ctx.protectedProcedure
		.input(
			z.object({
				projectId: z.string().uuid(),
				index: z.number().int().min(0).max(50),
				done: z.boolean(),
				minutes: z.number().int().min(0).max(600).default(0)
			})
		)
		.mutation(async ({ ctx: c, input }) => {
			const [project] = await db
				.select()
				.from(projects)
				.where(and(eq(projects.id, input.projectId), eq(projects.userId, c.user.id)))
				.limit(1);
			if (!project) throw new AppError('NOT_FOUND', 'Project not found');
			if (input.index >= project.milestones.length) throw new AppError('BAD_REQUEST', 'That milestone does not exist.');

			const result = await toggleMilestone(c.user.id, input.projectId, input.index, input.done);
			if (input.minutes > 0) {
				await db.insert(learningSessions).values({
					userId: c.user.id,
					topicId: project.topicId,
					kind: 'project',
					minutes: input.minutes,
					day: todayISO(),
					summary: `${project.title}: ${project.milestones[input.index].title}`
				});
			}
			return { progress: result, nextMilestone: project.milestones[result?.completedMilestones.length ?? 0] ?? null };
		}),

	/** Records repository link and a written reflection. */
	update: ctx.protectedProcedure
		.input(
			z.object({
				projectId: z.string().uuid(),
				repoUrl: z.string().url().max(400).nullable().default(null),
				reflection: z.string().trim().max(4000).nullable().default(null),
				status: z.enum(['not_started', 'in_progress', 'completed']).optional()
			})
		)
		.mutation(async ({ ctx: c, input }) => {
			const [project] = await db
				.select()
				.from(projects)
				.where(and(eq(projects.id, input.projectId), eq(projects.userId, c.user.id)))
				.limit(1);
			if (!project) throw new AppError('NOT_FOUND', 'Project not found');
			const [existing] = await db.select().from(projectProgress).where(eq(projectProgress.projectId, project.id)).limit(1);
			const now = new Date();
			const patch = {
				repoUrl: input.repoUrl,
				reflection: input.reflection,
				status: input.status ?? existing?.status ?? 'in_progress',
				updatedAt: now
			};
			if (existing) {
				const [row] = await db.update(projectProgress).set(patch).where(eq(projectProgress.id, existing.id)).returning();
				return row;
			}
			const [row] = await db
				.insert(projectProgress)
				.values({
					userId: c.user.id,
					projectId: project.id,
					completedMilestones: [],
					startedAt: now,
					...patch
				})
				.returning();
			return row;
		}),

	addNote: ctx.protectedProcedure
		.input(
			z.object({
				projectId: z.string().uuid(),
				title: z.string().trim().max(160).default('Project note'),
				body: z.string().trim().min(1).max(10000)
			})
		)
		.mutation(async ({ ctx: c, input }) => {
			const [project] = await db
				.select({ id: projects.id })
				.from(projects)
				.where(and(eq(projects.id, input.projectId), eq(projects.userId, c.user.id)))
				.limit(1);
			if (!project) throw new AppError('NOT_FOUND', 'Project not found');
			const [row] = await db
				.insert(notes)
				.values({ userId: c.user.id, projectId: input.projectId, title: input.title || 'Project note', body: input.body })
				.returning();
			return row;
		}),

	/** Project progress summary for the dashboard. */
	summary: ctx.protectedProcedure.query(async ({ ctx: c }) => {
		const bundle = await getRoadmapBundle(c.user.id);
		if (!bundle)
			return {
				total: 0,
				inProgress: 0,
				completed: 0,
				next: null as null | { id: string; title: string; nextMilestone: string | null }
			};
		const ids = bundle.projectList.map((p) => p.id);
		const states = ids.length > 0 ? await db.select().from(projectProgress).where(inArray(projectProgress.projectId, ids)) : [];
		const byId = new Map(states.map((s) => [s.projectId, s]));
		const candidates = bundle.projectList.filter((p) => (byId.get(p.id)?.status ?? 'not_started') !== 'completed');
		const chosen =
			candidates.sort((a, b) => (byId.get(a.id) ? 0 : 1) - (byId.get(b.id) ? 0 : 1) || a.difficulty - b.difficulty)[0] ?? null;
		if (!chosen) return { total: bundle.projectList.length, inProgress: 0, completed: bundle.projectList.length, next: null };
		const done = byId.get(chosen.id)?.completedMilestones.length ?? 0;
		return {
			total: bundle.projectList.length,
			inProgress: states.filter((s) => s.status === 'in_progress').length,
			completed: states.filter((s) => s.status === 'completed').length,
			next: { id: chosen.id, title: chosen.title, nextMilestone: chosen.milestones[done]?.title ?? null }
		};
	}),

	/** Cross-project time log, useful for the progress surface. */
	time: ctx.protectedProcedure.query(async ({ ctx: c }) => {
		const rows = await db
			.select({
				projectId: sql<string>`project_id`,
				minutes: sql<number>`sum(minutes)::int`,
				sessions: sql<number>`count(*)::int`
			})
			.from(sql`learning_sessions`)
			.where(sql`user_id = ${c.user.id} and kind = 'project' and project_id is not null`)
			.groupBy(sql`project_id`);
		const bundle = await getRoadmapBundle(c.user.id);
		const titleById = new Map((bundle?.projectList ?? []).map((p) => [p.id, p.title]));
		return rows
			.map((r) => ({
				projectId: r.projectId,
				title: titleById.get(r.projectId) ?? 'Project',
				minutes: r.minutes,
				sessions: r.sessions,
				human: humanMinutes(r.minutes)
			}))
			.filter((r) => titleById.has(r.projectId));
	})
});

void roadmapProgress;
void topicProgress;
