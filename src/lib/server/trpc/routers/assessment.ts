import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { clamp, humanMinutes, pct, todayISO } from '$lib/utils';
import { RESOURCES, TOPIC_BY_KEY } from '$server/catalog';
import { db } from '$server/db';
import {
	assessmentAttempts,
	assessmentQuestions,
	assessments,
	checkIns,
	learningSessions,
	notes,
	projects,
	topics
} from '$server/db/schema';
import { gradeAnswers } from '$server/engine/grader';
import { gradeFromScore, retention, schedule } from '$server/engine/srs';
import { AppError } from '$server/errors';
import { getRoadmapBundle, requireTopic } from '$server/services/access';
import { rememberFact } from '$server/services/learner-context';
import { applyProgress, logSession, recordReview, weakTopics } from '$server/services/progress';
import { ctx } from '../init';

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Creates the catalog-backed assessment for a topic on first access. */
export async function ensureTopicAssessment(userId: string, topicId: string) {
	const [existing] = await db
		.select()
		.from(assessments)
		.where(and(eq(assessments.userId, userId), eq(assessments.topicId, topicId)))
		.limit(1);
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
			description: `Confirm you understand ${topic.concepts.slice(0, 3).join(', ') || topic.title} before moving on.`,
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
			options: q.options ? q.options.map((label, i) => ({ key: String.fromCharCode(97 + i), label })) : [],
			answer: q.answer,
			keywords: q.keywords ?? [],
			explanation: q.explanation,
			concept: q.concept,
			points: q.type === 'short' || q.type === 'code' ? 2 : 1
		}))
	);

	return created;
}

export const assessmentRouter = ctx.router({
	/** A topic's assessment with answers withheld. */
	forTopic: ctx.protectedProcedure.input(z.object({ topicId: z.string().uuid() })).query(async ({ ctx: c, input }) => {
		const assessment = await ensureTopicAssessment(c.user.id, input.topicId);
		const [questions, previous, topic] = await Promise.all([
			db
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
				.orderBy(assessmentQuestions.position),
			db
				.select({
					id: assessmentAttempts.id,
					score: assessmentAttempts.score,
					passed: assessmentAttempts.passed,
					at: assessmentAttempts.createdAt
				})
				.from(assessmentAttempts)
				.where(and(eq(assessmentAttempts.userId, c.user.id), eq(assessmentAttempts.assessmentId, assessment.id)))
				.orderBy(desc(assessmentAttempts.createdAt))
				.limit(5),
			db.select({ title: topics.title }).from(topics).where(eq(topics.id, input.topicId)).limit(1)
		]);

		return {
			assessment: {
				id: assessment.id,
				title: assessment.title,
				description: assessment.description,
				passScore: assessment.passScore
			},
			topicTitle: topic[0]?.title ?? 'Topic',
			questions,
			attempts: previous,
			bestScore: previous.length > 0 ? Math.max(...previous.map((p) => p.score)) : null
		};
	}),

	history: ctx.protectedProcedure
		.input(z.object({ limit: z.number().int().min(1).max(50).default(20) }))
		.query(async ({ ctx: c, input }) =>
			db
				.select({
					id: assessmentAttempts.id,
					score: assessmentAttempts.score,
					passed: assessmentAttempts.passed,
					summary: assessmentAttempts.summary,
					createdAt: assessmentAttempts.createdAt,
					title: assessments.title,
					topicId: assessments.topicId,
					topicTitle: topics.title
				})
				.from(assessmentAttempts)
				.innerJoin(assessments, eq(assessments.id, assessmentAttempts.assessmentId))
				.leftJoin(topics, eq(topics.id, assessments.topicId))
				.where(eq(assessmentAttempts.userId, c.user.id))
				.orderBy(desc(assessmentAttempts.createdAt))
				.limit(input.limit)
		),

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
	 * Grades an attempt, reschedules the topic, updates mastery and records
	 * durable memory about the concepts that were and were not understood.
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

			const questions = await db
				.select()
				.from(assessmentQuestions)
				.where(eq(assessmentQuestions.assessmentId, assessment.id))
				.orderBy(assessmentQuestions.position);
			if (questions.length === 0) throw new AppError('PRECONDITION_FAILED', 'This assessment has no questions.');

			const graded = gradeAnswers(questions, input.answers);
			const passed = graded.score >= assessment.passScore;

			const summary = {
				understood: graded.understood,
				weak: graded.weak,
				revise: assessment.topicId ? [{ topicId: assessment.topicId, title: assessment.title }] : [],
				nextStep: passed
					? 'Move on to the next available topic, and keep this one in your revision rotation.'
					: 'Revise the concepts you missed, redo the practice items, then take this check again.'
			};

			const [attempt] = await db
				.insert(assessmentAttempts)
				.values({
					userId: c.user.id,
					assessmentId: assessment.id,
					answers: input.answers,
					results: graded.results.map((r) => ({
						questionId: r.questionId,
						correct: r.correct,
						score: r.score,
						feedback: r.feedback,
						concept: r.concept
					})),
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

				for (const concept of graded.weak.slice(0, 4)) {
					await rememberFact({
						userId: c.user.id,
						kind: 'weakness',
						key: concept,
						content: `Struggled with "${concept}" in ${assessment.title} (scored ${graded.score}%).`,
						topicId: assessment.topicId,
						source: 'assessment',
						confidence: 80
					});
				}
				for (const concept of graded.understood.slice(0, 4)) {
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

	/** Aggregate performance for the dashboard and progress surface. */
	overview: ctx.protectedProcedure.query(async ({ ctx: c }) => {
		const rows = await db
			.select({
				score: assessmentAttempts.score,
				passed: assessmentAttempts.passed,
				at: assessmentAttempts.createdAt,
				title: assessments.title,
				topicId: assessments.topicId,
				summary: assessmentAttempts.summary
			})
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
			weakestConcepts: [...conceptCounts.entries()]
				.sort((a, b) => b[1] - a[1])
				.slice(0, 6)
				.map(([concept, times]) => ({ concept, times })),
			trend: rows
				.slice(0, 8)
				.reverse()
				.map((r) => ({ score: r.score, title: r.title, at: r.at }))
		};
	}),

	recommend: ctx.protectedProcedure.query(async ({ ctx: c }) => {
		const bundle = await getRoadmapBundle(c.user.id);
		if (!bundle) return [];
		return bundle.topics
			.filter((t) => t.status !== 'not_started' && t.available)
			.map((t) => ({
				topicId: t.topicId,
				title: t.title,
				mastery: t.mastery,
				difficulty: t.difficulty,
				status: t.status,
				reason:
					t.mastery < 60
						? `Retention is ${t.mastery}%`
						: t.status === 'completed'
							? 'Confirm it stuck'
							: 'Check your understanding',
				score: 100 - t.mastery + t.difficulty * 4
			}))
			.sort((a, b) => b.score - a.score)
			.slice(0, 5);
	})
});

export const revisionRouter = ctx.router({
	/** The spaced-repetition queue, ordered by urgency. */
	queue: ctx.protectedProcedure
		.input(z.object({ limit: z.number().int().min(1).max(60).default(20) }))
		.query(async ({ ctx: c, input }) => {
			const bundle = await getRoadmapBundle(c.user.id);
			if (!bundle)
				return {
					due: [],
					soon: [],
					recentlyLearned: [],
					cooling: [],
					summary: { dueCount: 0, avgMastery: 0, reviewsThisWeek: 0 }
				};

			const now = Date.now();
			const scored = bundle.topics
				.filter((t) => t.status !== 'not_started' && t.available)
				.map((t) => {
					const overdueDays = t.nextReviewAt ? Math.round((now - new Date(t.nextReviewAt).getTime()) / 86_400_000) : -1;
					return { ...t, overdueDays };
				});

			const due = scored
				.filter((t) => t.overdueDays >= 0 && (t.status !== 'not_started' || t.mastery > 0))
				.sort((a, b) => b.overdueDays - a.overdueDays || a.mastery - b.mastery)
				.slice(0, input.limit);

			const soon = scored
				.filter((t) => t.overdueDays < 0 && t.overdueDays >= -3)
				.sort((a, b) => b.overdueDays - a.overdueDays)
				.slice(0, 8);

			const recentlyLearned = bundle.topics
				.filter((t) => t.status !== 'not_started' && t.lastReviewedAt)
				.sort((a, b) => (b.lastReviewedAt?.getTime() ?? 0) - (a.lastReviewedAt?.getTime() ?? 0))
				.slice(0, 6);

			// Topics mastered once but not revisited for a while — the ones that quietly decay.
			const cooling = bundle.topics
				.filter(
					(t) =>
						t.status === 'completed' &&
						t.mastery < 80 &&
						(!t.lastReviewedAt || (now - t.lastReviewedAt.getTime()) / 86_400_000 > 10)
				)
				.sort((a, b) => a.mastery - b.mastery)
				.slice(0, 6);

			const weekStart = new Date(now - 7 * 86_400_000);
			const [reviewsThisWeek] = await db
				.select({ total: sql<number>`count(*)::int` })
				.from(learningSessions)
				.where(
					and(
						eq(learningSessions.userId, c.user.id),
						eq(learningSessions.kind, 'revise'),
						sql`${learningSessions.createdAt} >= ${weekStart}`
					)
				);

			const avgMastery =
				bundle.topics.filter((t) => t.status !== 'not_started').length > 0
					? Math.round(
							bundle.topics.filter((t) => t.status !== 'not_started').reduce((s, t) => s + t.mastery, 0) /
								bundle.topics.filter((t) => t.status !== 'not_started').length
						)
					: 0;

			return {
				due: due.map((t) => ({
					topicId: t.topicId,
					title: t.title,
					domain: t.domain,
					mastery: t.mastery,
					difficulty: t.difficulty,
					overdueDays: t.overdueDays,
					nextReviewAt: t.nextReviewAt,
					lastReviewedAt: t.lastReviewedAt,
					reviewCount: t.reviewCount,
					intervalDays: t.intervalDays,
					estimatedMinutes: Math.max(5, Math.round(t.estimatedMinutes * 0.25))
				})),
				soon: soon.map((t) => ({
					topicId: t.topicId,
					title: t.title,
					mastery: t.mastery,
					nextReviewAt: t.nextReviewAt,
					intervalDays: t.intervalDays
				})),
				recentlyLearned: recentlyLearned.map((t) => ({
					topicId: t.topicId,
					title: t.title,
					mastery: t.mastery,
					lastReviewedAt: t.lastReviewedAt
				})),
				cooling: cooling.map((t) => ({
					topicId: t.topicId,
					title: t.title,
					mastery: t.mastery,
					lastReviewedAt: t.lastReviewedAt
				})),
				summary: {
					dueCount: due.length,
					avgMastery,
					reviewsThisWeek: reviewsThisWeek?.total ?? 0,
					totalScheduled: scored.filter((t) => t.nextReviewAt).length
				}
			};
		}),

	/** Records a completed revision pass and advances the schedule. */
	complete: ctx.protectedProcedure
		.input(
			z.object({
				topicId: z.string().uuid(),
				rating: z.number().int().min(1).max(5),
				minutes: z.number().int().min(1).max(180).default(10)
			})
		)
		.mutation(async ({ ctx: c, input }) => {
			await logSession({
				userId: c.user.id,
				topicId: input.topicId,
				kind: 'revise',
				minutes: input.minutes,
				day: todayISO(),
				summary: `Revision (rated ${input.rating}/5)`
			});
			const updated = await recordReview(c.user.id, input.topicId, input.rating);
			return {
				nextReviewAt: updated.nextReviewAt,
				intervalDays: updated.intervalDays,
				mastery: updated.mastery,
				message:
					input.rating >= 4
						? `Scheduled again in ${updated.intervalDays} day${updated.intervalDays === 1 ? '' : 's'}.`
						: 'Back on tomorrow — review the concept list before the next pass.'
			};
		}),

	/** A quick mixed quiz drawn from the learner's data, no AI required. */
	quickQuiz: ctx.protectedProcedure
		.input(z.object({ count: z.number().int().min(3).max(20).default(6) }))
		.query(async ({ ctx: c, input }) => {
			const bundle = await getRoadmapBundle(c.user.id);
			if (!bundle) return { items: [], topicIds: [] };
			const candidates = bundle.topics
				.filter((t) => t.status !== 'not_started' && t.available)
				.sort((a, b) => a.mastery - b.mastery)
				.slice(0, 8);
			const topicRows = await db
				.select()
				.from(topics)
				.where(
					and(
						eq(topics.userId, c.user.id),
						candidates.length > 0
							? inArray(
									topics.id,
									candidates.map((t) => t.topicId)
								)
							: sql`false`
					)
				);

			const items: {
				topicId: string;
				topicTitle: string;
				concept: string;
				prompt: string;
				options: { key: string; label: string }[];
				answer: string;
				explanation: string;
				difficulty: number;
			}[] = [];
			for (const topic of topicRows) {
				const catalog = topic.catalogKey ? TOPIC_BY_KEY.get(topic.catalogKey) : undefined;
				if (!catalog) continue;
				for (const question of catalog.questions) {
					if (question.type !== 'mcq') continue;
					items.push({
						topicId: topic.id,
						topicTitle: topic.title,
						concept: question.concept,
						prompt: question.prompt,
						options: (question.options ?? []).map((label, i) => ({ key: String.fromCharCode(97 + i), label })),
						answer: question.answer,
						explanation: question.explanation,
						difficulty: topic.difficulty
					});
					if (items.length >= input.count * 3) break;
				}
				if (items.length >= input.count * 3) break;
			}

			// Deterministic shuffle keyed to the day so a retake is not identical within a day.
			const seed = todayISO()
				.split('-')
				.join('')
				.split('')
				.reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
			const shuffled = items
				.map((item, index) => ({ item, k: (index * 7919 + seed) % 1009 }))
				.sort((a, b) => a.k - b.k)
				.map((x) => x.item)
				.slice(0, input.count);

			return { items: shuffled, topicIds: [...new Set(shuffled.map((i) => i.topicId))] };
		}),

	/** Topics the learner should revisit, with retention estimates attached. */
	weakAreas: ctx.protectedProcedure.query(async ({ ctx: c }) => {
		const weak = await weakTopics(c.user.id, 10);
		const bundle = await getRoadmapBundle(c.user.id);
		const snapshots = bundle?.topics ?? [];
		return weak.map((w) => {
			const snap = snapshots.find((s) => s.topicId === w.topicId);
			return {
				...w,
				estimatedMinutes: snap ? Math.max(5, Math.round(snap.estimatedMinutes * 0.3)) : 10,
				nextReviewAt: snap?.nextReviewAt ?? null,
				retention: snap
					? retention({ mastery: snap.mastery, reviewCount: snap.reviewCount, lastReviewedAt: snap.lastReviewedAt })
					: w.mastery
			};
		});
	})
});

export { rawResult };

function rawResult(_value: unknown) {
	return _value;
}

export type AttemptResultRow = { questionId: string; correct: boolean; score: number; feedback: string; concept: string };

void clamp;
void humanMinutes;
void pct;
void checkIns;
void notes;
void projects;
void RESOURCES;
