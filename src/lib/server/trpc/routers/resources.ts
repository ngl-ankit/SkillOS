import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { humanMinutes, pct, relTime, todayISO } from '$lib/utils';
import { RESOURCES } from '$server/catalog';
import { db } from '$server/db';
import {
	learningSessions,
	notes,
	projects,
	resources,
	savedResources,
	topicProgress,
	topicResources,
	topics
} from '$server/db/schema';
import { AppError } from '$server/errors';
import { getPrimaryGoal, getRoadmapBundle } from '$server/services/access';
import { ctx } from '../init';

export const resourcesRouter = ctx.router({
	/**
	 * Catalog resources with each learner-scoped field resolved: saved state,
	 * whether it belongs to a current topic, and whether it is already done.
	 */
	list: ctx.protectedProcedure
		.input(
			z.object({
				role: z.enum(['all', 'primary', 'alternative', 'practice', 'project']).default('all'),
				type: z
					.enum(['all', 'documentation', 'tutorial', 'course', 'video', 'interactive', 'book', 'project', 'exercise', 'article'])
					.default('all'),
				cost: z.enum(['all', 'free', 'freemium', 'paid']).default('all'),
				difficulty: z.enum(['all', '1', '2', '3', '4', '5']).default('all'),
				query: z.string().trim().max(120).default(''),
				savedOnly: z.boolean().default(false),
				limit: z.number().int().min(1).max(400).default(200)
			})
		)
		.query(async ({ ctx: c, input }) => {
			const bundle = await getRoadmapBundle(c.user.id);
			const savedRows = await db.select().from(savedResources).where(eq(savedResources.userId, c.user.id));
			const savedBySlug = new Map<string, { status: string; savedAt: Date }>();
			if (savedRows.length > 0) {
				const ids = savedRows.map((s) => s.resourceId);
				for (const row of await db
					.select({ id: resources.id, slug: resources.slug })
					.from(resources)
					.where(inArray(resources.id, ids))) {
					const saved = savedRows.find((s) => s.resourceId === row.id);
					if (saved) savedBySlug.set(row.slug, { status: saved.status, savedAt: saved.createdAt });
				}
			}

			// Which catalog resources belong to the learner's own current roadmap.
			const catalogKeys = (bundle?.topics ?? []).map((t) => t.topicId).filter(Boolean);
			const topicRows =
				catalogKeys.length > 0
					? await db
							.select({ id: topics.id, catalogKey: topics.catalogKey, title: topics.title })
							.from(topics)
							.where(inArray(topics.id, catalogKeys))
					: [];
			const currentSlugs = new Map<string, string>();
			if (bundle) {
				const { TOPIC_BY_KEY } = await import('$server/catalog');
				for (const topic of topicRows) {
					const catalog = topic.catalogKey ? TOPIC_BY_KEY.get(topic.catalogKey) : undefined;
					for (const slug of Object.values(catalog?.resources ?? {})) {
						if (slug) currentSlugs.set(slug, topic.title);
					}
				}
			}

			const query = input.query.toLowerCase();
			let items = RESOURCES.filter((r) => {
				if (input.role !== 'all' && !Object.values(currentSlugs).includes(r.slug)) {
					// Role filtering happens below against the topic mapping.
				}
				if (input.type !== 'all' && r.type !== input.type) return false;
				if (input.cost !== 'all' && r.cost !== input.cost) return false;
				if (input.difficulty !== 'all' && String(r.difficulty) !== input.difficulty) return false;
				if (query.length >= 2 && !`${r.title} ${r.provider} ${r.description} ${r.tags.join(' ')}`.toLowerCase().includes(query))
					return false;
				if (input.savedOnly && !savedBySlug.has(r.slug)) return false;
				return true;
			});

			// Role filter needs the topic→resource mapping, so it is applied with that context.
			if (input.role !== 'all') {
				const roleSlugs = new Set<string>();
				const { TOPIC_BY_KEY } = await import('$server/catalog');
				if (bundle) {
					for (const topic of topicRows) {
						const catalog = topic.catalogKey ? TOPIC_BY_KEY.get(topic.catalogKey) : undefined;
						const slug = catalog?.resources[input.role as 'primary' | 'alternative' | 'practice' | 'project'];
						if (slug) roleSlugs.add(slug);
					}
				}
				items = items.filter((r) => roleSlugs.has(r.slug));
			}

			items = items.slice(0, input.limit);

			return {
				items: items.map((r) => ({
					...r,
					saved: savedBySlug.has(r.slug),
					savedStatus: savedBySlug.get(r.slug)?.status ?? null,
					forTopic: currentSlugs.get(r.slug) ?? null,
					onRoadmap: currentSlugs.has(r.slug)
				})),
				facets: {
					total: RESOURCES.length,
					shown: items.length,
					saved: savedBySlug.size,
					onRoadmap: currentSlugs.size
				}
			};
		}),

	/** Curated picks for the learner's current topic and weakest areas. */
	recommended: ctx.protectedProcedure.query(async ({ ctx: c }) => {
		const bundle = await getRoadmapBundle(c.user.id);
		const goal = await getPrimaryGoal(c.user.id);
		const { TOPIC_BY_KEY } = await import('$server/catalog');
		if (!bundle) {
			return { current: [], revision: [], practice: [], reason: 'Finish onboarding to get personalised resource picks.' };
		}

		const topicRows = await db
			.select({ id: topics.id, catalogKey: topics.catalogKey, title: topics.title })
			.from(topics)
			.where(eq(topics.roadmapId, bundle.roadmap.id));
		const byId = new Map(topicRows.map((t) => [t.id, t]));

		const current =
			bundle.topics.find((t) => t.status === 'in_progress') ??
			bundle.topics.find((t) => t.available && t.status === 'not_started') ??
			null;
		const weak = [...bundle.topics]
			.filter((t) => t.status !== 'not_started' && t.mastery < 70)
			.sort((a, b) => a.mastery - b.mastery)
			.slice(0, 2);

		const collect = (snap: { topicId: string } | null) => {
			if (!snap) return [];
			const row = byId.get(snap.topicId);
			const catalog = row?.catalogKey ? TOPIC_BY_KEY.get(row.catalogKey) : undefined;
			if (!catalog) return [];
			return (Object.entries(catalog.resources) as [string, string | undefined][])
				.map(([role, slug]) => {
					const found = RESOURCES.find((r) => r.slug === slug);
					return found ? { ...found, role, forTopic: row?.title ?? '' } : null;
				})
				.filter((r): r is NonNullable<typeof r> => r !== null);
		};

		return {
			current: collect(current),
			revision: weak.flatMap((w) => collect(w)).slice(0, 4),
			practice: collect(current).filter((r) => r.role === 'practice' || r.type === 'interactive' || r.type === 'exercise'),
			reason: current
				? `Picked for "${current.title}", the topic you are on now${goal ? ` in ${goal.title}` : ''}.`
				: 'Picked from your roadmap.'
		};
	}),

	save: ctx.protectedProcedure
		.input(z.object({ slug: z.string().max(120), status: z.enum(['saved', 'in_progress', 'done']).default('saved') }))
		.mutation(async ({ ctx: c, input }) => {
			const catalog = RESOURCES.find((r) => r.slug === input.slug);
			if (!catalog) throw new AppError('NOT_FOUND', 'Resource not found');

			// Materialise the catalog row the first time a learner touches it.
			let [row] = await db.select().from(resources).where(eq(resources.slug, input.slug)).limit(1);
			if (!row) {
				[row] = await db
					.insert(resources)
					.values({
						slug: catalog.slug,
						title: catalog.title,
						url: catalog.url,
						provider: catalog.provider,
						type: catalog.type,
						difficulty: catalog.difficulty,
						cost: catalog.cost,
						estimatedMinutes: catalog.minutes,
						prerequisites: '',
						description: catalog.description,
						whyUseful: catalog.why,
						tags: catalog.tags
					})
					.onConflictDoUpdate({ target: resources.slug, set: { updatedAt: new Date() } })
					.returning();
			}

			const [saved] = await db
				.insert(savedResources)
				.values({ userId: c.user.id, resourceId: row.id, status: input.status })
				.onConflictDoUpdate({
					target: [savedResources.userId, savedResources.resourceId],
					set: { status: input.status, updatedAt: new Date() }
				})
				.returning();
			return { resource: row, saved };
		}),

	unsave: ctx.protectedProcedure.input(z.object({ slug: z.string().max(120) })).mutation(async ({ ctx: c, input }) => {
		const [row] = await db.select({ id: resources.id }).from(resources).where(eq(resources.slug, input.slug)).limit(1);
		if (!row) return { ok: true };
		await db.delete(savedResources).where(and(eq(savedResources.userId, c.user.id), eq(savedResources.resourceId, row.id)));
		return { ok: true };
	}),

	/** Logs study time against a resource by way of its parent topic. */
	markLearned: ctx.protectedProcedure
		.input(
			z.object({
				slug: z.string().max(120),
				minutes: z.number().int().min(1).max(600),
				topicId: z.string().uuid().nullable().default(null)
			})
		)
		.mutation(async ({ ctx: c, input }) => {
			const { applyProgress, logSession } = await import('$server/services/progress');
			if (input.topicId) {
				await applyProgress(c.user.id, { topicId: input.topicId }, input.minutes);
			}
			await logSession({
				userId: c.user.id,
				topicId: input.topicId,
				kind: 'learn',
				minutes: input.minutes,
				day: todayISO(),
				summary: `Studied resource ${input.slug}`
			});
			return { ok: true };
		}),

	/** Everything saved, grouped by status for the saved-resources surface. */
	saved: ctx.protectedProcedure.query(async ({ ctx: c }) => {
		const rows = await db
			.select({
				id: resources.id,
				slug: resources.slug,
				title: resources.title,
				url: resources.url,
				provider: resources.provider,
				type: resources.type,
				difficulty: resources.difficulty,
				cost: resources.cost,
				estimatedMinutes: resources.estimatedMinutes,
				description: resources.description,
				whyUseful: resources.whyUseful,
				status: savedResources.status,
				savedAt: savedResources.createdAt,
				updatedAt: savedResources.updatedAt
			})
			.from(savedResources)
			.innerJoin(resources, eq(resources.id, savedResources.resourceId))
			.where(eq(savedResources.userId, c.user.id))
			.orderBy(desc(savedResources.updatedAt));

		return {
			all: rows,
			byStatus: {
				saved: rows.filter((r) => r.status === 'saved'),
				in_progress: rows.filter((r) => r.status === 'in_progress'),
				done: rows.filter((r) => r.status === 'done')
			},
			totalMinutesDone: rows.filter((r) => r.status === 'done').reduce((sum, r) => sum + r.estimatedMinutes, 0)
		};
	}),

	/** Which resources the roadmap attaches to a given topic. */
	forTopic: ctx.protectedProcedure.input(z.object({ topicId: z.string().uuid() })).query(async ({ ctx: c, input }) => {
		const bundle = await getRoadmapBundle(c.user.id);
		const snap = bundle?.topics.find((t) => t.topicId === input.topicId);
		if (!snap) throw new AppError('NOT_FOUND', 'Topic not found');
		const [row] = await db.select({ catalogKey: topics.catalogKey }).from(topics).where(eq(topics.id, input.topicId)).limit(1);
		const { TOPIC_BY_KEY } = await import('$server/catalog');
		const catalog = row?.catalogKey ? TOPIC_BY_KEY.get(row.catalogKey) : undefined;
		if (!catalog) return [];
		return (Object.entries(catalog.resources) as [string, string | undefined][])
			.map(([role, slug]) => {
				const found = RESOURCES.find((r) => r.slug === slug);
				return found ? { ...found, role } : null;
			})
			.filter((r): r is NonNullable<typeof r> => r !== null);
	}),

	/** Study-time totals per resource type, for the progress surface. */
	stats: ctx.protectedProcedure.query(async ({ ctx: c }) => {
		const rows = await db
			.select({ kind: learningSessions.kind, minutes: sql<number>`sum(${learningSessions.minutes})::int` })
			.from(learningSessions)
			.where(eq(learningSessions.userId, c.user.id))
			.groupBy(learningSessions.kind);
		const total = rows.reduce((sum, r) => sum + r.minutes, 0);
		return {
			total,
			human: humanMinutes(total),
			byKind: rows.map((r) => ({ kind: r.kind, minutes: r.minutes, percent: pct(r.minutes, total) })),
			lastSession: await db
				.select({ summary: learningSessions.summary, createdAt: learningSessions.createdAt, minutes: learningSessions.minutes })
				.from(learningSessions)
				.where(eq(learningSessions.userId, c.user.id))
				.orderBy(desc(learningSessions.createdAt))
				.limit(1)
				.then((r) => r[0] ?? null)
		};
	})
});

void topicResources;
void topicProgress;
void notes;
void projects;
void asc;
void relTime;
