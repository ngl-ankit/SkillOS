import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { todayISO } from '$lib/utils';
import { cacheStats } from '$server/ai/gateway';
import { db } from '$server/db';
import {
	aiCache,
	aiConversations,
	aiMemory,
	assessmentAttempts,
	checkIns,
	dailyPlans,
	goals,
	learningSessions,
	notes,
	profiles,
	userPreferences
} from '$server/db/schema';
import { AppError } from '$server/errors';
import { getPreferences, getProfile } from '$server/services/access';
import { learningStats } from '$server/services/insights';
import { streak } from '$server/services/progress';
import { ctx } from '../init';

const prefsSchema = z.object({
	universeMode: z.enum(['auto', '3d', '2d']).optional(),
	reducedMotion: z.boolean().optional(),
	reminderHour: z.number().int().min(0).max(23).optional(),
	notificationsEnabled: z.boolean().optional(),
	intensity: z.number().int().min(50).max(150).optional(),
	mentorAnswerStyle: z.enum(['guided', 'direct']).optional()
});

const profileSchema = z.object({
	displayName: z.string().trim().min(1).max(80).optional(),
	level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
	dailyMinutes: z.number().int().min(10).max(600).optional(),
	learningStyle: z.enum(['reading', 'video', 'hands_on', 'mixed']).optional(),
	targetRole: z.string().trim().max(120).nullable().optional(),
	deadline: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.nullable()
		.optional(),
	timezone: z.string().trim().max(64).optional()
});

export const settingsRouter = ctx.router({
	overview: ctx.protectedProcedure.query(async ({ ctx: c }) => {
		const [profile, prefs, stats, streakInfo, cache] = await Promise.all([
			getProfile(c.user.id),
			getPreferences(c.user.id),
			learningStats(c.user.id, todayISO()),
			streak(c.user.id, todayISO()),
			cacheStats(c.user.id)
		]);
		return { profile, preferences: prefs, stats, streak: streakInfo, cache };
	}),

	updatePreferences: ctx.protectedProcedure.input(prefsSchema).mutation(async ({ ctx: c, input }) => {
		if (Object.keys(input).length === 0) return getPreferences(c.user.id);
		const [row] = await db
			.update(userPreferences)
			.set({ ...input, updatedAt: new Date() })
			.where(eq(userPreferences.userId, c.user.id))
			.returning();
		return row;
	}),

	updateProfile: ctx.protectedProcedure.input(profileSchema).mutation(async ({ ctx: c, input }) => {
		if (Object.keys(input).length === 0) return getProfile(c.user.id);
		const [row] = await db
			.update(profiles)
			.set({ ...input, updatedAt: new Date() })
			.where(eq(profiles.userId, c.user.id))
			.returning();
		if (!row) throw new AppError('NOT_FOUND', 'Profile not found');
		return row;
	}),

	/** Full JSON export of everything the learner produced. */
	exportData: ctx.protectedProcedure.query(async ({ ctx: c }) => {
		const userId = c.user.id;
		const [profile, prefs, goalRows, planRows, noteRows, sessionRows, attemptRows, convoRows, memoryRows] = await Promise.all([
			getProfile(userId),
			getPreferences(userId),
			db.select().from(goals).where(eq(goals.userId, userId)),
			db.select().from(dailyPlans).where(eq(dailyPlans.userId, userId)),
			db.select().from(notes).where(eq(notes.userId, userId)),
			db.select().from(learningSessions).where(eq(learningSessions.userId, userId)).limit(2000),
			db.select().from(assessmentAttempts).where(eq(assessmentAttempts.userId, userId)).limit(1000),
			db
				.select({ id: aiConversations.id, title: aiConversations.title, createdAt: aiConversations.createdAt })
				.from(aiConversations)
				.where(eq(aiConversations.userId, userId)),
			db.select().from(aiMemory).where(eq(aiMemory.userId, userId))
		]);
		return {
			exportedAt: new Date().toISOString(),
			profile,
			preferences: prefs,
			goals: goalRows,
			dailyPlans: planRows,
			notes: noteRows,
			learningSessions: sessionRows,
			assessmentAttempts: attemptRows,
			conversations: convoRows,
			memory: memoryRows
		};
	}),

	clearCache: ctx.protectedProcedure.mutation(async ({ ctx: c }) => {
		await db.delete(aiCache).where(eq(aiCache.userId, c.user.id));
		return cacheStats(c.user.id);
	}),

	/** Removes all learning data but keeps the account and sign-in intact. */
	resetLearningData: ctx.protectedProcedure.mutation(async ({ ctx: c }) => {
		const userId = c.user.id;
		await db.delete(aiMemory).where(eq(aiMemory.userId, userId));
		await db.delete(aiCache).where(eq(aiCache.userId, userId));
		await db.delete(aiConversations).where(eq(aiConversations.userId, userId));
		await db.delete(assessmentAttempts).where(eq(assessmentAttempts.userId, userId));
		await db.delete(checkIns).where(eq(checkIns.userId, userId));
		await db.delete(dailyPlans).where(eq(dailyPlans.userId, userId));
		await db.delete(learningSessions).where(eq(learningSessions.userId, userId));
		await db.delete(notes).where(and(eq(notes.userId, userId), eq(notes.userId, userId)));
		// Roadmaps cascade from goals.
		await db.delete(goals).where(eq(goals.userId, userId));
		const [profile] = await db
			.update(profiles)
			.set({ onboardedAt: null, updatedAt: new Date() })
			.where(eq(profiles.userId, userId))
			.returning();
		return { ok: true, profile };
	})
});
