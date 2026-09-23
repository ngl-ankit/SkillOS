import { sql } from 'drizzle-orm';
import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	real,
	smallint,
	text,
	timestamp,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { contentSourceEnum, roadmapStatusEnum, topicStatusEnum } from './enums';
import { goals } from './learner';
import type { PracticeExercise } from './types';

export const roadmaps = pgTable(
	'roadmaps',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		goalId: uuid('goal_id')
			.notNull()
			.references(() => goals.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		summary: text('summary').notNull().default(''),
		status: roadmapStatusEnum('status').notNull().default('generating'),
		source: contentSourceEnum('source').notNull().default('catalog'),
		version: integer('version').notNull().default(1),
		adjustmentNote: text('adjustment_note'),
		adjustedAt: timestamp('adjusted_at', { withTimezone: true }),
		failureReason: text('failure_reason'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('roadmaps_user_idx').on(t.userId),
		uniqueIndex('roadmaps_one_active_per_goal').on(t.goalId).where(sql`${t.status} <> 'archived'`)
	]
);

export const roadmapPhases = pgTable(
	'roadmap_phases',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		roadmapId: uuid('roadmap_id')
			.notNull()
			.references(() => roadmaps.id, { onDelete: 'cascade' }),
		position: smallint('position').notNull(),
		title: text('title').notNull(),
		description: text('description').notNull().default(''),
		milestoneTitle: text('milestone_title').notNull(),
		milestoneDetail: text('milestone_detail').notNull().default(''),
		milestoneReachedAt: timestamp('milestone_reached_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [uniqueIndex('roadmap_phases_position_uq').on(t.roadmapId, t.position)]
);

export const topics = pgTable(
	'topics',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		roadmapId: uuid('roadmap_id')
			.notNull()
			.references(() => roadmaps.id, { onDelete: 'cascade' }),
		phaseId: uuid('phase_id')
			.notNull()
			.references(() => roadmapPhases.id, { onDelete: 'cascade' }),
		slug: text('slug').notNull(),
		catalogKey: text('catalog_key'),
		domain: text('domain').notNull().default('General'),
		title: text('title').notNull(),
		description: text('description').notNull(),
		difficulty: smallint('difficulty').notNull(),
		estimatedMinutes: integer('estimated_minutes').notNull(),
		position: smallint('position').notNull(),
		concepts: text('concepts').array().notNull().default([]),
		practice: jsonb('practice').$type<PracticeExercise[]>().notNull().default([]),
		source: contentSourceEnum('source').notNull().default('catalog'),
		isReinforcement: boolean('is_reinforcement').notNull().default(false),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('topics_user_idx').on(t.userId),
		index('topics_roadmap_idx').on(t.roadmapId, t.position),
		uniqueIndex('topics_roadmap_slug_uq').on(t.roadmapId, t.slug)
	]
);

export const topicPrerequisites = pgTable(
	'topic_prerequisites',
	{
		topicId: uuid('topic_id')
			.notNull()
			.references(() => topics.id, { onDelete: 'cascade' }),
		prerequisiteId: uuid('prerequisite_id')
			.notNull()
			.references(() => topics.id, { onDelete: 'cascade' })
	},
	(t) => [primaryKey({ columns: [t.topicId, t.prerequisiteId] }), index('topic_prereq_reverse_idx').on(t.prerequisiteId)]
);

export const topicProgress = pgTable(
	'topic_progress',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		topicId: uuid('topic_id')
			.notNull()
			.references(() => topics.id, { onDelete: 'cascade' }),
		status: topicStatusEnum('status').notNull().default('not_started'),
		progressPct: smallint('progress_pct').notNull().default(0),
		/** 0–100 estimate of how well the learner knows this topic. */
		mastery: smallint('mastery').notNull().default(0),
		minutesSpent: integer('minutes_spent').notNull().default(0),
		practiceDone: smallint('practice_done').array().notNull().default([]),
		priorKnowledge: boolean('prior_knowledge').notNull().default(false),
		reviewCount: smallint('review_count').notNull().default(0),
		easeFactor: real('ease_factor').notNull().default(2.5),
		intervalDays: smallint('interval_days').notNull().default(0),
		nextReviewAt: timestamp('next_review_at', { withTimezone: true }),
		lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
		startedAt: timestamp('started_at', { withTimezone: true }),
		completedAt: timestamp('completed_at', { withTimezone: true }),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('topic_progress_user_topic_uq').on(t.userId, t.topicId),
		index('topic_progress_review_idx').on(t.userId, t.nextReviewAt)
	]
);
