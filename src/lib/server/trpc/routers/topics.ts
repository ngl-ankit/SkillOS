import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { clamp, todayISO } from '$lib/utils';
import { db } from '$server/db';
import { notes, topicProgress, topics } from '$server/db/schema';
import { AppError } from '$server/errors';
import { RESOURCE_BY_SLUG, TOPIC_BY_KEY } from '$server/catalog';
import { ensureTopicProgress, getRoadmapBundle, requireTopic } from '$server/services/access';
import { applyProgress, logSession, recordReview } from '$server/services/progress';
import { gradePracticeHint } from '$server/engine/grader';
import { revisionPriority } from '$server/engine/srs';
import { ctx } from '../init';

/** Everything needed to actually learn a topic rather than just open a link. */
export async function buildTopicWorkspace(userId: string, topicId: string) {
	const bundle = await getRoadmapBundle(userId);
	const snapshot = bundle?.topics.find((t) => t.topicId === topicId) ?? null;
	const row = await requireTopic(userId, topicId);
	const progress = await ensureTopicProgress(userId, topicId);

	const catalog = row.catalogKey ? TOPIC_BY_KEY.get(row.catalogKey) : undefined;
	const resources = catalog
		? (Object.entries(catalog.resources) as [string, string | undefined][])
				.map(([role, slug]) => {
					if (!slug) return null;
					const resource = RESOURCE_BY_SLUG.get(slug);
					return resource ? { role, ...resource } : null;
				})
				.filter((r): r is NonNullable<typeof r> => r !== null)
		: [];

	const related = (bundle?.topics ?? [])
		.filter((t) => t.topicId !== topicId && t.domain === row.domain && t.available)
		.slice(0, 4)
		.map((t) => ({ topicId: t.topicId, title: t.title, status: t.status, progressPct: t.progressPct }));

	const [assessment] = await db
		.select({
			id: sql<string>`a.id`,
			title: sql<string>`a.title`,
			questionCount: sql<number>`(select count(*) from assessment_questions q where q.assessment_id = a.id)::int`
		})
		.from(sql`assessments a`.as('a'))
		.where(sql`a.user_id = ${userId} and a.topic_id = ${topicId}`)
		.limit(1);

	const noteRows = await db
		.select()
		.from(notes)
		.where(and(eq(notes.userId, userId), eq(notes.topicId, topicId)))
		.orderBy(desc(notes.updatedAt))
		.limit(20);

	const recentSessions = await db
		.select()
		.from(sql`learning_sessions ls`.as('ls'))
		.where(sql`ls.user_id = ${userId} and ls.topic_id = ${topicId}`)
		.orderBy(sql`ls.created_at desc`)
		.limit(10);

	return {
		topic: {
			id: row.id,
			title: row.title,
			description: row.description,
			domain: row.domain,
			difficulty: row.difficulty,
			estimatedMinutes: row.estimatedMinutes,
			concepts: row.concepts,
			practice: row.practice,
			isReinforcement: row.isReinforcement
		},
		progress: {
			status: progress.status,
			progressPct: progress.progressPct,
			mastery: progress.mastery,
			minutesSpent: progress.minutesSpent,
			practiceDone: (progress.practiceDone ?? []) as number[],
			reviewCount: progress.reviewCount,
			intervalDays: progress.intervalDays,
			easeFactor: progress.easeFactor,
			nextReviewAt: progress.nextReviewAt,
			lastReviewedAt: progress.lastReviewedAt,
			startedAt: progress.startedAt,
			completedAt: progress.completedAt,
			priorKnowledge: progress.priorKnowledge
		},
		snapshot,
		resources,
		related,
		assessment: assessment ?? null,
		notes: noteRows,
		sessions: recentSessions,
		whyItMatters: catalog
			? `${catalog.description} It sits in the "${row.domain}" area of your roadmap${snapshot?.prerequisiteTitles.length ? ` and builds on ${snapshot.prerequisiteTitles.join(', ')}` : ''}.`
			: row.description
	};
}

export const topicsRouter = ctx.router({
	workspace: ctx.protectedProcedure.input(z.object({ topicId: z.string().uuid() })).query(({ ctx: c, input }) => buildTopicWorkspace(c.user.id, input.topicId)),

	/** Starts or resumes a focused session. */
	start: ctx.protectedProcedure.input(z.object({ topicId: z.string().uuid() })).mutation(async ({ ctx: c, input }) => {
		const row = await requireTopic(c.user.id, input.topicId);
		const progress = await ensureTopicProgress(c.user.id, input.topicId);
		if (progress.status === 'not_started') {
			await applyProgress(c.user.id, {
				topicId: input.topicId,
				status: 'in_progress',
				progressPct: Math.max(progress.progressPct, 5),
				startedAt: new Date()
			});
		}
		return { topicId: row.id, title: row.title, concepts: row.concepts, practice: row.practice, estimatedMinutes: row.estimatedMinutes };
	}),

	/** Persists incremental progress plus the minutes actually spent. */
	update: ctx.protectedProcedure
		.input(
			z.object({
				topicId: z.string().uuid(),
				progressPct: z.number().int().min(0).max(100).optional(),
				minutes: z.number().int().min(0).max(600).default(0),
				note: z.string().max(2000).nullable().default(null)
			})
		)
		.mutation(async ({ ctx: c, input }) => {
			await ensureTopicProgress(c.user.id, input.topicId);
			const updated = await applyProgress(c.user.id, { topicId: input.topicId, progressPct: input.progressPct }, input.minutes);
			if (input.minutes > 0) {
				await logSession({ userId: c.user.id, topicId: input.topicId, kind: 'learn', minutes: input.minutes, day: todayISO(), summary: input.note ?? undefined });
			}
			return updated;
		}),

	/** Completes a topic and immediately schedules its first spaced review. */
	complete: ctx.protectedProcedure
		.input(z.object({ topicId: z.string().uuid(), minutes: z.number().int().min(0).max(600).default(0), confidence: z.number().int().min(1).max(5).default(4) }))
		.mutation(async ({ ctx: c, input }) => {
			await ensureTopicProgress(c.user.id, input.topicId);
			const row = await applyProgress(c.user.id, { topicId: input.topicId, status: 'completed', progressPct: 100 }, input.minutes);
			const scheduled = await recordReview(c.user.id, input.topicId, clamp(input.confidence, 1, 5));
			if (input.minutes > 0) {
				await logSession({ userId: c.user.id, topicId: input.topicId, kind: 'learn', minutes: input.minutes, day: todayISO(), summary: 'Completed topic' });
			}
			return { progress: row, scheduled };
		}),

	reopen: ctx.protectedProcedure.input(z.object({ topicId: z.string().uuid() })).mutation(async ({ ctx: c, input }) => {
		await requireTopic(c.user.id, input.topicId);
		await ensureTopicProgress(c.user.id, input.topicId);
		return applyProgress(c.user.id, { topicId: input.topicId, status: 'in_progress', progressPct: 60, completedAt: null });
	}),

	/** Deterministic, offline-safe practice check. */
	checkPractice: ctx.protectedProcedure
		.input(z.object({ topicId: z.string().uuid(), exerciseIndex: z.number().int().min(0).max(50), answer: z.string().max(6000) }))
		.query(async ({ ctx: c, input }) => {
			const row = await requireTopic(c.user.id, input.topicId);
			const exercise = row.practice[input.exerciseIndex];
			if (!exercise) throw new AppError('NOT_FOUND', 'Exercise not found');
			const catalog = row.catalogKey ? TOPIC_BY_KEY.get(row.catalogKey) : undefined;
			const reference = catalog?.questions.find((q) => q.keywords?.length) ?? catalog?.questions[0];
			const keywords = reference?.keywords ?? row.concepts.slice(0, 4);
			const graded = gradePracticeHint(input.answer, keywords);
			return {
				ok: graded.ok,
				hint: graded.hint,
				expected: reference?.answer ?? null,
				explanation: reference?.explanation ?? null,
				exercise: { title: exercise.title, prompt: exercise.prompt, hint: exercise.hint ?? null }
			};
		}),

	/** Toggles an exercise done and advances progress proportionally. */
	togglePractice: ctx.protectedProcedure
		.input(z.object({ topicId: z.string().uuid(), exerciseIndex: z.number().int().min(0).max(50), done: z.boolean(), minutes: z.number().int().min(0).max(300).default(0) }))
		.mutation(async ({ ctx: c, input }) => {
			const progress = await ensureTopicProgress(c.user.id, input.topicId);
			const current = new Set<number>(Array.isArray(progress.practiceDone) ? (progress.practiceDone as number[]) : []);
			if (input.done) current.add(input.exerciseIndex);
			else current.delete(input.exerciseIndex);
			const list = [...current].filter((i) => i >= 0).sort((a, b) => a - b);
			const topic = await requireTopic(c.user.id, input.topicId);
			const ratio = topic.practice.length > 0 ? list.length / topic.practice.length : 0;
			const nextPct = Math.max(progress.progressPct, Math.round(clamp(ratio, 0, 1) * 80));
			const [updated] = await db
				.update(topicProgress)
				.set({ practiceDone: list, progressPct: nextPct, updatedAt: new Date() })
				.where(and(eq(topicProgress.topicId, input.topicId), eq(topicProgress.userId, c.user.id)))
				.returning();
			if (input.minutes > 0) {
				await logSession({ userId: c.user.id, topicId: input.topicId, kind: 'practice', minutes: input.minutes, day: todayISO() });
			}
			return { practiceDone: updated?.practiceDone ?? list, progressPct: nextPct };
		}),

	addNote: ctx.protectedProcedure
		.input(z.object({ topicId: z.string().uuid(), title: z.string().trim().max(160).default('Note'), body: z.string().trim().min(1).max(8000) }))
		.mutation(async ({ ctx: c, input }) => {
			await requireTopic(c.user.id, input.topicId);
			const [row] = await db
				.insert(notes)
				.values({ userId: c.user.id, topicId: input.topicId, title: input.title || 'Note', body: input.body })
				.returning();
			return row;
		}),

	/** Pulls a topic's review forward to now. */
	requestRevision: ctx.protectedProcedure.input(z.object({ topicId: z.string().uuid() })).mutation(async ({ ctx: c, input }) => {
		await requireTopic(c.user.id, input.topicId);
		await ensureTopicProgress(c.user.id, input.topicId);
		return applyProgress(c.user.id, { topicId: input.topicId, nextReviewAt: new Date() });
	}),

	/** Explains where this topic sits in the revision queue. */
	revisionRank: ctx.protectedProcedure.input(z.object({ topicId: z.string().uuid() })).query(async ({ ctx: c, input }) => {
		const bundle = await getRoadmapBundle(c.user.id);
		if (!bundle || bundle.topics.length === 0) return { rank: null, total: 0, priority: 0, reason: 'No roadmap yet.' };
		const ranked = bundle.topics
			.map((t) => ({
				topicId: t.topicId,
				priority: revisionPriority({ nextReviewAt: t.nextReviewAt, mastery: t.mastery, reviewCount: t.reviewCount, difficulty: t.difficulty })
			}))
			.sort((a, b) => b.priority - a.priority);
		const index = ranked.findIndex((r) => r.topicId === input.topicId);
		const snap = bundle.topics.find((t) => t.topicId === input.topicId);
		const overdue = snap?.nextReviewAt ? Math.round((Date.now() - new Date(snap.nextReviewAt).getTime()) / 86_400_000) : 0;
		const reason = !snap
			? 'Unknown topic.'
			: overdue > 0
				? `${overdue} day${overdue === 1 ? '' : 's'} past its review date.`
				: snap.mastery < 70
					? `Retention is ${snap.mastery}% and it has been reviewed ${snap.reviewCount} time${snap.reviewCount === 1 ? '' : 's'}.`
					: 'Scheduled further out — nothing urgent.';
		return { rank: index >= 0 ? index + 1 : null, total: ranked.length, priority: ranked[index]?.priority ?? 0, reason };
	}),

	/** Searches the learner's own roadmap topics. */
	find: ctx.protectedProcedure.input(z.object({ query: z.string().trim().max(120).default('') })).query(async ({ ctx: c, input }) => {
		if (input.query.trim().length < 2) return [];
		const like = `%${input.query.trim().toLowerCase()}%`;
		return db
			.select({ id: topics.id, title: topics.title, domain: topics.domain, description: topics.description })
			.from(topics)
			.where(and(eq(topics.userId, c.user.id), sql`(lower(${topics.title}) like ${like} or lower(${topics.description}) like ${like})`))
			.limit(12);
	}),

	notes: ctx.protectedProcedure.input(z.object({ topicId: z.string().uuid() })).query(async ({ ctx: c, input }) =>
		db.select().from(notes).where(and(eq(notes.userId, c.user.id), eq(notes.topicId, input.topicId))).orderBy(desc(notes.updatedAt))
	),

	/** Domain list for filters on the learn surface. */
	domains: ctx.protectedProcedure.query(async ({ ctx: c }) => {
		const rows = await db
			.select({ domain: topics.domain, total: sql<number>`count(*)::int` })
			.from(topics)
			.where(eq(topics.userId, c.user.id))
			.groupBy(topics.domain)
			.orderBy(desc(sql`count(*)`));
		return rows;
	})
});

void inArray;
void asc;
