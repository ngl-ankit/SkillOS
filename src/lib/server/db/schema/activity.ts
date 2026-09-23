import { date, index, integer, jsonb, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { completionEnum, planItemKindEnum, planItemStatusEnum, planStatusEnum, sessionKindEnum, tomorrowPrefEnum } from './enums';
import { goals } from './learner';
import { topics } from './roadmap';
import type { PlanItemRef } from './types';

export const learningSessions = pgTable(
	'learning_sessions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		topicId: uuid('topic_id').references(() => topics.id, { onDelete: 'set null' }),
		kind: sessionKindEnum('kind').notNull(),
		minutes: smallint('minutes').notNull(),
		summary: text('summary'),
		day: date('day').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('learning_sessions_user_day_idx').on(t.userId, t.day), index('learning_sessions_topic_idx').on(t.topicId)]
);

export const dailyPlans = pgTable(
	'daily_plans',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		goalId: uuid('goal_id').references(() => goals.id, { onDelete: 'set null' }),
		day: date('day').notNull(),
		budgetMinutes: smallint('budget_minutes').notNull(),
		plannedMinutes: smallint('planned_minutes').notNull(),
		focus: text('focus').notNull(),
		rationale: text('rationale').array().notNull().default([]),
		aiNote: text('ai_note'),
		status: planStatusEnum('status').notNull().default('active'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [uniqueIndex('daily_plans_user_day_uq').on(t.userId, t.day)]
);

export const dailyPlanItems = pgTable(
	'daily_plan_items',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		planId: uuid('plan_id')
			.notNull()
			.references(() => dailyPlans.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		position: smallint('position').notNull(),
		kind: planItemKindEnum('kind').notNull(),
		title: text('title').notNull(),
		detail: text('detail').notNull().default(''),
		minutes: smallint('minutes').notNull(),
		ref: jsonb('ref').$type<PlanItemRef>().notNull().default({}),
		status: planItemStatusEnum('status').notNull().default('pending'),
		completedAt: timestamp('completed_at', { withTimezone: true })
	},
	(t) => [index('daily_plan_items_plan_idx').on(t.planId, t.position), index('daily_plan_items_user_idx').on(t.userId)]
);

export const checkIns = pgTable(
	'check_ins',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		planId: uuid('plan_id').references(() => dailyPlans.id, { onDelete: 'set null' }),
		day: date('day').notNull(),
		completedPlan: completionEnum('completed_plan').notNull(),
		minutesStudied: smallint('minutes_studied').notNull(),
		difficulty: smallint('difficulty').notNull(),
		confidence: smallint('confidence').notNull(),
		blockers: text('blockers').array().notNull().default([]),
		blockerNote: text('blocker_note'),
		tomorrow: tomorrowPrefEnum('tomorrow').notNull(),
		/** Human-readable interpretation that feeds tomorrow's plan. */
		adaptation: text('adaptation').notNull().default(''),
		reviewBias: integer('review_bias').notNull().default(0),
		intensityAfter: integer('intensity_after').notNull().default(100),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [uniqueIndex('check_ins_user_day_uq').on(t.userId, t.day)]
);
