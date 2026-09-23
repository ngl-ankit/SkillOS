import { sql } from 'drizzle-orm';
import { boolean, date, index, integer, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { goalStatusEnum, learningStyleEnum, levelEnum } from './enums';

export const profiles = pgTable('profiles', {
	userId: text('user_id')
		.primaryKey()
		.references(() => users.id, { onDelete: 'cascade' }),
	displayName: text('display_name').notNull(),
	level: levelEnum('level').notNull().default('beginner'),
	existingSkills: text('existing_skills').array().notNull().default([]),
	dailyMinutes: smallint('daily_minutes').notNull().default(60),
	learningStyle: learningStyleEnum('learning_style').notNull().default('mixed'),
	targetRole: text('target_role'),
	deadline: date('deadline'),
	timezone: text('timezone').notNull().default('UTC'),
	onboardedAt: timestamp('onboarded_at', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const userPreferences = pgTable('user_preferences', {
	userId: text('user_id')
		.primaryKey()
		.references(() => users.id, { onDelete: 'cascade' }),
	universeMode: text('universe_mode', { enum: ['auto', '3d', '2d'] }).notNull().default('auto'),
	reducedMotion: boolean('reduced_motion').notNull().default(false),
	reminderHour: smallint('reminder_hour').notNull().default(18),
	notificationsEnabled: boolean('notifications_enabled').notNull().default(true),
	/** Percentage applied to daily minutes, adapted from check-ins (50–150). */
	intensity: integer('intensity_pct').notNull().default(100),
	mentorAnswerStyle: text('mentor_answer_style', { enum: ['guided', 'direct'] }).notNull().default('guided'),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const goals = pgTable(
	'goals',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		trackSlug: text('track_slug'),
		level: levelEnum('level').notNull(),
		targetRole: text('target_role'),
		dailyMinutes: smallint('daily_minutes').notNull(),
		deadline: date('deadline'),
		motivation: text('motivation'),
		status: goalStatusEnum('status').notNull().default('active'),
		isPrimary: boolean('is_primary').notNull().default(false),
		completedAt: timestamp('completed_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('goals_user_idx').on(t.userId, t.status),
		uniqueIndex('goals_one_primary_per_user').on(t.userId).where(sql`${t.isPrimary} = true`)
	]
);
