import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$server/db';
import { profiles, userPreferences } from '$server/db/schema';
import { getPreferences, getProfile, listGoals } from '$server/services/access';
import { activitySeries, buildToday } from '$server/services/dashboard';
import { learningStats } from '$server/services/insights';
import { streak, weakTopics } from '$server/services/progress';
import { aiAvailable, modelId } from '$server/ai/client';
import { ctx } from '../init';

const level = z.enum(['beginner', 'intermediate', 'advanced']);

export const profileRouter = ctx.router({
	/** Single bootstrap payload for the shell: identity, preferences, AI status. */
	me: ctx.protectedProcedure.query(async ({ ctx: c }) => {
		const [profile, preferences, goalList] = await Promise.all([getProfile(c.user.id), getPreferences(c.user.id), listGoals(c.user.id)]);
		return {
			user: { id: c.user.id, name: c.user.name, email: c.user.email },
			profile,
			preferences,
			onboarded: Boolean(profile?.onboardedAt),
			goals: goalList,
			ai: { available: aiAvailable(), model: aiAvailable() ? modelId() : null }
		};
	}),

	overview: ctx.protectedProcedure
		.input(z.object({ today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), days: z.number().int().min(7).max(90).default(14) }).default({ today: new Date().toISOString().slice(0, 10), days: 14 }))
		.query(async ({ ctx: c, input }) => {
			const [stats, series, days, weak, today] = await Promise.all([
				learningStats(c.user.id, input.today),
				activitySeries(c.user.id, input.today, input.days),
				streak(c.user.id, input.today),
				weakTopics(c.user.id, 6),
				buildToday(c.user.id, input.today)
			]);
			return { stats, series, streak: days, weak, today };
		}),

	update: ctx.protectedProcedure
		.input(
			z.object({
				displayName: z.string().trim().min(1).max(80).optional(),
				level: level.optional(),
				existingSkills: z.array(z.string().trim().min(1).max(60)).max(40).optional(),
				dailyMinutes: z.number().int().min(10).max(600).optional(),
				learningStyle: z.enum(['reading', 'video', 'hands_on', 'mixed']).optional(),
				targetRole: z.string().trim().max(120).nullable().optional(),
				deadline: z
					.string()
					.regex(/^\d{4}-\d{2}-\d{2}$/)
					.nullable()
					.optional(),
				timezone: z.string().max(64).optional()
			})
		)
		.mutation(async ({ ctx: c, input }) => {
			const [row] = await db
				.update(profiles)
				.set({ ...input, updatedAt: new Date() })
				.where(eq(profiles.userId, c.user.id))
				.returning();
			return row;
		}),

	preferences: ctx.protectedProcedure.query(({ ctx: c }) => getPreferences(c.user.id)),

	updatePreferences: ctx.protectedProcedure
		.input(
			z.object({
				universeMode: z.enum(['auto', '3d', '2d']).optional(),
				reducedMotion: z.boolean().optional(),
				reminderHour: z.number().int().min(0).max(23).optional(),
				notificationsEnabled: z.boolean().optional(),
				intensity: z.number().int().min(50).max(150).optional(),
				mentorAnswerStyle: z.enum(['guided', 'direct']).optional()
			})
		)
		.mutation(async ({ ctx: c, input }) => {
			const now = new Date();
			const [row] = await db
				.insert(userPreferences)
				.values({ userId: c.user.id, ...input })
				.onConflictDoUpdate({ target: userPreferences.userId, set: { ...input, updatedAt: now } })
				.returning();
			return row;
		})
});
