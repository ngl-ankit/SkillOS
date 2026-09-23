import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { TRACKS } from '$server/catalog';
import { db } from '$server/db';
import { goals, profiles, userPreferences } from '$server/db/schema';
import { generateRoadmap, rankTracks } from '$server/engine/roadmap';
import { ctx } from '../init';
import { rememberFact } from '$server/services/learner-context';

const level = z.enum(['beginner', 'intermediate', 'advanced']);
const style = z.enum(['reading', 'video', 'hands_on', 'mixed']);

export const onboardingRouter = ctx.router({
	/** Everything the onboarding wizard needs to render, including suggested tracks. */
	state: ctx.protectedProcedure.query(async ({ ctx: c }) => {
		const [profile] = await db.select().from(profiles).where(eq(profiles.userId, c.user.id)).limit(1);
		const existing = await db.select({ id: goals.id }).from(goals).where(and(eq(goals.userId, c.user.id), sql`${goals.status} <> 'archived'`));
		return {
			completed: Boolean(profile?.onboardedAt),
			hasGoals: existing.length > 0,
			profile: profile ?? null,
			preferences: (await db.select().from(userPreferences).where(eq(userPreferences.userId, c.user.id)).limit(1))[0] ?? null
		};
	}),

	tracks: ctx.protectedProcedure.query(() =>
		TRACKS.map((track) => ({
			slug: track.slug,
			title: track.title,
			role: track.role,
			summary: track.summary,
			phaseCount: track.phases.length,
			topicCount: track.phases.reduce((sum, p) => sum + p.topics.length, 0)
		}))
	),

	/** Live track suggestions as the learner types their goal. */
	suggest: ctx.protectedProcedure
		.input(z.object({ goal: z.string().min(2).max(200), targetRole: z.string().max(120).nullable().optional(), skills: z.array(z.string().max(60)).max(30).default([]) }))
		.query(({ input }) =>
			rankTracks(input.goal, input.targetRole ?? null, input.skills)
				.slice(0, 4)
				.map(({ track, score }) => ({ slug: track.slug, title: track.title, summary: track.summary, match: score }))
		),

	/**
	 * Completes onboarding: stores the profile, creates the primary goal and
	 * generates the first roadmap in one transaction-safe sequence.
	 */
	complete: ctx.protectedProcedure
		.input(
			z.object({
				displayName: z.string().trim().min(1).max(80),
				goalTitle: z.string().trim().min(3).max(200),
				level,
				existingSkills: z.array(z.string().trim().min(1).max(60)).max(40).default([]),
				dailyMinutes: z.number().int().min(10).max(600),
				learningStyle: style,
				targetRole: z.string().trim().max(120).nullable().default(null),
				deadline: z
					.string()
					.regex(/^\d{4}-\d{2}-\d{2}$/)
					.nullable()
					.default(null),
				motivation: z.string().trim().max(400).nullable().default(null),
				trackSlug: z.string().max(80).nullable().default(null),
				timezone: z.string().max(64).default('UTC'),
				today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
			})
		)
		.mutation(async ({ ctx: c, input }) => {
			const now = new Date();
			await db
				.insert(profiles)
				.values({
					userId: c.user.id,
					displayName: input.displayName,
					level: input.level,
					existingSkills: input.existingSkills,
					dailyMinutes: input.dailyMinutes,
					learningStyle: input.learningStyle,
					targetRole: input.targetRole,
					deadline: input.deadline,
					timezone: input.timezone,
					onboardedAt: now
				})
				.onConflictUpdate((t) => ({ userId: t.userId }))
				.execute?.() ??
				(await db
					.insert(profiles)
					.values({
						userId: c.user.id,
						displayName: input.displayName,
						level: input.level,
						existingSkills: input.existingSkills,
						dailyMinutes: input.dailyMinutes,
						learningStyle: input.learningStyle,
						targetRole: input.targetRole,
						deadline: input.deadline,
						timezone: input.timezone,
						onboardedAt: now
					})
					.onConflictDoUpdate({
						target: profiles.userId,
						set: {
							displayName: input.displayName,
							level: input.level,
							existingSkills: input.existingSkills,
							dailyMinutes: input.dailyMinutes,
							learningStyle: input.learningStyle,
							targetRole: input.targetRole,
							deadline: input.deadline,
							timezone: input.timezone,
							onboardedAt: now,
							updatedAt: now
						}
					}));

			// One primary goal per learner: demote any existing primary first.
			await db.update(goals).set({ isPrimary: false, updatedAt: now }).where(and(eq(goals.userId, c.user.id), eq(goals.isPrimary, true)));
			const [goal] = await db
				.insert(goals)
				.values({
					userId: c.user.id,
					title: input.goalTitle,
					trackSlug: input.trackSlug,
					level: input.level,
					targetRole: input.targetRole,
					dailyMinutes: input.dailyMinutes,
					deadline: input.deadline,
					motivation: input.motivation,
					status: 'active',
					isPrimary: true
				})
				.returning();

			await db
				.insert(userPreferences)
				.values({ userId: c.user.id })
				.onConflictDoUpdate({ target: userPreferences.userId, set: { updatedAt: now } });

			const result = await generateRoadmap({
				userId: c.user.id,
				goalId: goal.id,
				goalTitle: input.goalTitle,
				targetRole: input.targetRole,
				level: input.level,
				skills: input.existingSkills,
				dailyMinutes: input.dailyMinutes,
				deadline: input.deadline,
				trackSlug: input.trackSlug,
				today: input.today
			});

			await rememberFact({
				userId: c.user.id,
				kind: 'goal',
				key: input.goalTitle.slice(0, 120),
				content: `Working toward "${input.goalTitle}"${input.targetRole ? ` for a ${input.targetRole} role` : ''} at ${input.dailyMinutes} min/day.`,
				source: 'onboarding',
				confidence: 90
			});
			if (input.motivation) {
				await rememberFact({
					userId: c.user.id,
					kind: 'preference',
					key: 'motivation',
					content: `Motivation: ${input.motivation.slice(0, 300)}`,
					source: 'onboarding',
					confidence: 70
				});
			}
			for (const skill of input.existingSkills.slice(0, 12)) {
				await rememberFact({
					userId: c.user.id,
					kind: 'skill',
					key: skill.slice(0, 60),
					content: `Already comfortable with ${skill}.`,
					source: 'onboarding',
					confidence: 80
				});
			}

			return { goalId: goal.id, roadmapId: result.roadmapId, topics: result.topicIdsByCatalogKey.size, skipped: result.blueprint.skipped.length };
		})
});
