import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { clamp, todayISO } from '$lib/utils';
import { db } from '$server/db';
import { assessmentAttempts, assessmentQuestions, assessments, dailyPlanItems, dailyPlans, projectProgress, projects, topicProgress, topics } from '$server/db/schema';
import { AppError } from '$server/errors';
import { TOPIC_BY_KEY } from '$server/catalog';
import { getRoadmapBundle, requireTopic } from '$server/services/access';
import { applyProgress, logSession, recordReview } from '$server/services/progress';
import { gradeAnswers } from '$server/engine/grader';
import { gradeFromScore, schedule } from '$server/engine/srs';
import { rememberFact, resolveMemory } from '$server/services/learner-context';
import { ctx } from '../init';

export { assessmentQuestions, assessmentAttempts, assessments, topicProgress, topics, projects, projectProgress, dailyPlans, dailyPlanItems };

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const notesRouter = ctx.router({
	/** Full-text-ish search across the learner's notes. */
	list: ctx.protectedProcedure
		.input(
			z.object({
				query: z.string().trim().max(160).default(''),
				filter: z.enum(['all', 'topic', 'resource', 'project', 'session', 'unlinked']).default('all'),
				limit: z.number().int().min(1).max(200).default(100)
			})
		)
		.query(async ({ ctx: c, input }) => {
			const conditions = [eq(notes.userId, c.user.id)];
			if (input.query.length >= 2) {
				const like = `%${input.query.toLowerCase()}%`;
				conditions.push(sql`(lower(${notes.title}) like ${like} or lower(${notes.body}) like ${like})`);
			}
			if (input.filter === 'topic') conditions.push(sql`${notes.topicId} is not null`);
			if (input.filter === 'resource') conditions.push(sql`${notes.resourceId} is not null`);
			if (input.filter === 'project') conditions.push(sql`${notes.projectId} is not null`);
			if (input.filter === 'session') conditions.push(sql`${notes.sessionId} is not null`);
			if (input.filter === 'unlinked') conditions.push(sql`${notes.topicId} is null and ${notes.projectId} is null and ${notes.resourceId} is null`);

			const rows = await db
				.select()
				.from(notes)
				.where(and(...conditions))
				.orderBy(desc(notes.updatedAt))
				.limit(input.limit);

			// Attach the linked entity's title so the list is navigable.
			const topicIds = rows.map((r) => r.topicId).filter((id): id is string => Boolean(id));
			const projectIds = rows.map((r) => r.projectId).filter((id): id is string => Boolean(id));
			const topicTitles = new Map<string, string>();
			const projectTitles = new Map<string, string>();
			if (topicIds.length > 0) {
				for (const row of await db.select({ id: topics.id, title: topics.title }).from(topics).where(inArray(topics.id, topicIds))) {
					topicTitles.set(row.id, row.title);
				}
			}
			if (projectIds.length > 0) {
				for (const row of await db.select({ id: projects.id, title: projects.title }).from(projects).where(inArray(projects.id, projectIds))) {
					projectTitles.set(row.id, row.title);
				}
			}

			return rows.map((row) => ({
				...row,
				topicTitle: row.topicId ? (topicTitles.get(row.topicId) ?? null) : null,
				projectTitle: row.projectId ? (projectTitles.get(row.projectId) ?? null) : null,
				excerpt: row.body.replace(/\s+/g, ' ').slice(0, 180)
			}));
		}),

	byId: ctx.protectedProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx: c, input }) => {
		const [row] = await db
			.select()
			.from(notes)
			.where(and(eq(notes.id, input.id), eq(notes.userId, c.user.id)))
			.limit(1);
		if (!row) throw new AppError('NOT_FOUND', 'Note not found');
		return row;
	}),

	create: ctx.protectedProcedure
		.input(
			z.object({
				title: z.string().trim().max(160).default('Note'),
				body: z.string().trim().min(1).max(20000),
				topicId: z.string().uuid().nullable().default(null),
				resourceId: z.string().uuid().nullable().default(null),
				projectId: z.string().uuid().nullable().default(null),
				sessionId: z.string().uuid().nullable().default(null)
			})
		)
		.mutation(async ({ ctx: c, input }) => {
			const [row] = await db
				.insert(notes)
				.values({
					userId: c.user.id,
					title: input.title.trim() || 'Note',
					body: input.body,
					topicId: input.topicId,
					resourceId: input.resourceId,
					projectId: input.projectId,
					sessionId: input.sessionId
				})
				.returning();
			return row;
		}),

	update: ctx.protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				title: z.string().trim().max(160).optional(),
				body: z.string().trim().min(1).max(20000).optional(),
				topicId: z.string().uuid().nullable().optional(),
				projectId: z.string().uuid().nullable().optional()
			})
		)
		.mutation(async ({ ctx: c, input }) => {
			const { id, ...patch } = input;
			const [row] = await db
				.update(notes)
				.set({ ...patch, updatedAt: new Date() })
				.where(and(eq(notes.id, id), eq(notes.userId, c.user.id)))
				.returning();
			if (!row) throw new AppError('NOT_FOUND', 'Note not found');
			return row;
		}),

	remove: ctx.protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx: c, input }) => {
		const [row] = await db
			.delete(notes)
			.where(and(eq(notes.id, input.id), eq(notes.userId, c.user.id)))
			.returning({ id: notes.id });
		if (!row) throw new AppError('NOT_FOUND', 'Note not found');
		return { ok: true };
	}),

	counts: ctx.protectedProcedure.query(async ({ ctx: c }) => {
		const [row] = await db
			.select({
				total: sql<number>`count(*)::int`,
				linked: sql<number>`count(${notes.topicId})::int`,
				projects: sql<number>`count(${notes.projectId})::int`
			})
			.from(notes)
			.where(eq(notes.userId, c.user.id));
		return row ?? { total: 0, linked: 0, projects: 0 };
	})
});

/** Assessment generation from catalog questions, persisted so attempts are comparable. */
export async function ensureTopicAssessment(userId: string, topicId: string) {
	const [existing] = await db.select().from(assessments).where(and(eq(assessments.userId, userId), eq(assessments.topicId, topicId))).limit(1);
	if (existing) return existing;

	const topic = await requireTopic(userId, topicId);
	const catalog = topic.catalogKey ? TOPIC_BY_KEY.get(topic.catalogKey) : undefined;
	const questions = catalog?.questions ?? [];
	if (questions.length === 0) throw new AppError('PRECONDITION_FAILED', 'This topic has no curated questions yet.');

	const [created] = await db
		.insert(assessments)
		.values({
			userId,
			roadmapId: topic.roadmapId,
			topicId,
			kind: 'topic',
			title: `${topic.title} — knowledge check`,
			description: `A short check on ${topic.concepts.slice(0, 3).join(', ') || topic.title} to confirm understanding before moving on.`,
			passScore: 70,
			source: 'catalog'
		})
		.returning();

	await db.insert(assessmentQuestions).values(
		questions.map((q, index) => ({
			assessmentId: created.id,
			position: index + 1,
			type: q.type,
			prompt: q.prompt,
			code: q.code ?? null,
			options: q.options ? q.options.map((label, i) => ({ key: String.fromCharCode(97 + i), label })) : null,
			answer: q.answer,
			keywords: q.keywords ?? null,
			explanation: q.explanation,
			concept: q.concept,
			points: q.type === 'short' || q.type === 'code' ? 2 : 1
		}))
	);

	return created;
}

export const assessmentRouter = ctx.router({
	/** A topic's assessment without answers exposed. */
	forTopic: ctx.protectedProcedure.input(z.object({ topicId: z.string().uuid() })).query(async ({ ctx: c, input }) => {
		const assessment = await ensureTopicAssessment(c.user.id, input.topicId);
		const questions = await db
			.select({
				id: assessmentQuestions.id,
				position: assessmentQuestions.position,
				type: assessmentQuestions.type,
				prompt: assessmentQuestions.prompt,
				code: assessmentQuestions.code,
				options: assessmentQuestions.options,
				concept: assessmentQuestions.concept,
				points: assessmentQuestions.points
			})
			.from(assessmentQuestions)
			.where(eq(assessmentQuestions.assessmentId, assessment.id))
			.orderBy(assessmentQuestions.position);

		const previous = await db
			.select({ id: assessmentAttempts.id, score: assessmentAttempts.score, passed: assessmentAttempts.passed, at: assessmentAttempts.createdAt })
			.from(assessmentAttempts)
			.where(and(eq(assessmentAttempts.userId, c.user.id), eq(assessmentAttempts.assessmentId, assessment.id)))
			.orderBy(desc(assessmentAttempts.createdAt))
			.limit(5);

		return {
			assessment: { id: assessment.id, title: assessment.title, description: assessment.description, passScore: assessment.passScore },
			questions,
			attempts: previous
		};
	}),

	attempts: ctx.protectedProcedure.input(z.object({ topicId: z.string().uuid().nullable().default(null), limit: z.number().int().min(1).max(50).default(20) })).query(async ({ ctx: c, input }) => {
		const conditions = [eq(assessmentAttempts.userId, c.user.id)];
		const rows = await db
			.select({
				id: assessmentAttempts.id,
				score: assessmentAttempts.score,
				passed: assessmentAttempts.passed,
				summary: assessmentAttempts.summary,
				durationSeconds: assessmentAttempts.durationSeconds,
				createdAt: assessmentAttempts.createdAt,
				title: assessments.title,
				topicId: assessments.topicId,
				topicTitle: topics.title
			})
			.from(assessmentAttempts)
			.innerJoin(assessments, eq(assessments.id, assessmentAttempts.assessmentId))
			.leftJoin(topics, eq(topics.id, assessments.topicId))
			.where(and(...conditions))
			.orderBy(desc(assessmentAttempts.createdAt))
			.limit(input.limit);
		return input.topicId ? rows.filter((r) => r.topicId === input.topicId) : rows;
	}),

	attempt: ctx.protectedProcedure.input(z.object({ attemptId: z.string().uuid() })).query(async ({ ctx: c, input }) => {
		const [row] = await db
			.select()
			.from(assessmentAttempts)
			.where(and(eq(assessmentAttempts.id, input.attemptId), eq(assessmentAttempts.userId, c.user.id)))
			.limit(1);
		if (!row) throw new AppError('NOT_FOUND', 'Attempt not found');
		const [assessment] = await db.select().from(assessments).where(eq(assessments.id, row.assessmentId)).limit(1);
		return { attempt: row, assessment: assessment ?? null };
	}),

	/**
	 * Grades an attempt, schedules the next review, updates mastery and writes
	 * durable memory about what was and was not understood.
	 */
	submit: ctx.protectedProcedure
		.input(
			z.object({
				assessmentId: z.string().uuid(),
				answers: z.record(z.string(), z.string().max(6000)),
				durationSeconds: z.number().int().min(0).max(36_000).default(0),
				day: daySchema.optional()
			})
		)
		.mutation(async ({ ctx: c, input }) => {
			const [assessment] = await db
				.select()
				.from(assessments)
				.where(and(eq(assessments.id, input.assessmentId), eq(assessments.userId, c.user.id)))
				.limit(1);
			if (!assessment) throw new AppError('NOT_FOUND', 'Assessment not found');

			const questions = await db.select().from(assessmentQuestions).where(eq(assessmentQuestions.assessmentId, assessment.id)).orderBy(assessmentQuestions.position);
			if (questions.length === 0) throw new AppError('PRECONDITION_FAILED', 'This assessment has no questions.');

			const graded = gradeAnswers(questions, input.answers);
			const passed = graded.score >= assessment.passScore;

			const summary = {
				understood: graded.understood,
				weak: graded.weak,
				revise: assessment.topicId ? [{ topicId: assessment.topicId, title: assessment.title }] : [],
				nextStep: passed
					? 'Move on to the next available topic, and keep this one in the revision rotation.'
					: 'Revise the weak concepts, redo the practice items, then take this check again.',
				results: graded.results.map((r) => ({
					questionId: r.questionId,
					correct: r.correct,
					score: r.score,
					feedback: r.feedback,
					concept: r.concept
				}))
			};

			const [attempt] = await db
				.insert(assessmentAttempts)
				.values({
					userId: c.user.id,
					assessmentId: assessment.id,
					answers: input.answers,
					results: summary,
					score: graded.score,
					passed,
					summary,
					durationSeconds: input.durationSeconds
				})
				.returning();

			if (assessment.topicId) {
				const grade = gradeFromScore(graded.score);
				const current = await applyProgress(c.user.id, {
					topicId: assessment.topicId,
					mastery: graded.score,
					progressPct: passed ? 100 : undefined,
					status: passed ? 'completed' : 'in_progress'
				});
				const outcome = schedule(
					{ easeFactor: current.easeFactor, intervalDays: current.intervalDays, reviewCount: current.reviewCount },
					grade
				);
				await applyProgress(c.user.id, {
					topicId: assessment.topicId,
					mastery: graded.score,
					lastReviewedAt: outcome.lastReviewedAt,
					nextReviewAt: outcome.nextReviewAt,
					intervalDays: outcome.intervalDays,
					easeFactor: outcome.easeFactor,
					reviewCount: outcome.reviewCount
				});

				// Assessment outcomes are the most reliable signal about this learner.
				for (const concept of graded.weak.slice(0, 4)) {
					await rememberFact({
						userId: c.user.id,
						kind: 'weakness',
						key: `${concept}`,
						content: `Struggled with "${concept}" in ${assessment.title} (scored ${graded.score}%).`,
						topicId: assessment.topicId,
						source: 'assessment',
						confidence: 80
					});
				}
				for (const concept of graded.understood.slice(0, 4)) {
					await resolveMemory(c.user.id, 'weakness', concept);
					await rememberFact({
						userId: c.user.id,
						kind: 'strength',
						key: concept,
						content: `Solid grasp of "${concept}" — confirmed in ${assessment.title} (${graded.score}%).`,
						topicId: assessment.topicId,
						source: 'assessment',
						confidence: 75
					});
				}
				await logSession({
					userId: c.user.id,
					topicId: assessment.topicId,
					kind: 'assess',
					minutes: Math.max(1, Math.round(input.durationSeconds / 60)),
					day: input.day ?? todayISO(),
					summary: `${assessment.title}: ${graded.score}%`
				});
			}

			return {
				attemptId: attempt.id,
				score: graded.score,
				passed,
				passScore: assessment.passScore,
				understood: graded.understood,
				weak: graded.weak,
				results: graded.results,
				nextStep: summary.nextStep
			};
		}),

	/** Aggregate performance used by the dashboard and the insight engine. */
	overview: ctx.protectedProcedure.query(async ({ ctx: c }) => {
		const rows = await db
			.select({ score: assessmentAttempts.score, passed: assessmentAttempts.passed, at: assessmentAttempts.createdAt, title: assessments.title, summary: assessmentAttempts.summary })
			.from(assessmentAttempts)
			.innerJoin(assessments, eq(assessments.id, assessmentAttempts.assessmentId))
			.where(eq(assessmentAttempts.userId, c.user.id))
			.orderBy(desc(assessmentAttempts.createdAt))
			.limit(40);

		const conceptCounts = new Map<string, number>();
		for (const row of rows) {
			const summary = row.summary as { weak?: string[] } | null;
			for (const concept of summary?.weak ?? []) conceptCounts.set(concept, (conceptCounts.get(concept) ?? 0) + 1);
		}

		return {
			average: rows.length > 0 ? Math.round(rows.reduce((sum, r) => sum + r.score, 0) / rows.length) : null,
			passRate: rows.length > 0 ? Math.round((rows.filter((r) => r.passed).length / rows.length) * 100) : null,
			count: rows.length,
			recent: rows.slice(0, 10),
			weakestConcepts: [...conceptCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([concept, times]) => ({ concept, times })),
			trend: rows.slice(0, 8).reverse().map((r) => ({ score: r.score, title: r.title, at: r.at }))
		};
	}),

	/** Topics worth re-testing, ordered by how much they need it. */
	recommend: ctx.protectedProcedure.query(async ({ ctx: c }) => {
		const bundle = await getRoadmapBundle(c.user.id);
		if (!bundle) return [];
		const ranked = bundle.topics
			.filter((t) => t.status !== 'not_started' && t.available)
			.map((t) => ({ topicId: t.topicId, title: t.title, mastery: t.mastery, difficulty: t.difficulty, status: t.status, score: (100 - t.mastery) + t.difficulty * 4 }))
			.sort((a, b) => b.score - a.score)
			.slice(0, 5);
		return ranked;
	})
});

void clamp;
void projectProgress;
