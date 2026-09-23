import { boolean, index, jsonb, pgTable, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { assessmentKindEnum, contentSourceEnum, questionTypeEnum } from './enums';
import { roadmaps, topics } from './roadmap';
import type { AttemptSummary, QuestionOption, QuestionResult } from './types';

export const assessments = pgTable(
	'assessments',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		roadmapId: uuid('roadmap_id').references(() => roadmaps.id, { onDelete: 'cascade' }),
		topicId: uuid('topic_id').references(() => topics.id, { onDelete: 'cascade' }),
		kind: assessmentKindEnum('kind').notNull().default('topic'),
		title: text('title').notNull(),
		description: text('description').notNull().default(''),
		passScore: smallint('pass_score').notNull().default(70),
		source: contentSourceEnum('source').notNull().default('catalog'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('assessments_user_idx').on(t.userId), index('assessments_topic_idx').on(t.topicId)]
);

export const assessmentQuestions = pgTable(
	'assessment_questions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		assessmentId: uuid('assessment_id')
			.notNull()
			.references(() => assessments.id, { onDelete: 'cascade' }),
		position: smallint('position').notNull(),
		type: questionTypeEnum('type').notNull(),
		prompt: text('prompt').notNull(),
		code: text('code'),
		options: jsonb('options').$type<QuestionOption[]>().notNull().default([]),
		/** Server-only. mcq/true_false: option key. short/code: reference answer. */
		answer: text('answer').notNull(),
		/** Patterns indicating understanding in free-text answers. Server-only. */
		keywords: text('keywords').array().notNull().default([]),
		explanation: text('explanation').notNull(),
		concept: text('concept').notNull(),
		points: smallint('points').notNull().default(1)
	},
	(t) => [index('assessment_questions_assessment_idx').on(t.assessmentId, t.position)]
);

export const assessmentAttempts = pgTable(
	'assessment_attempts',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		assessmentId: uuid('assessment_id')
			.notNull()
			.references(() => assessments.id, { onDelete: 'cascade' }),
		answers: jsonb('answers').$type<Record<string, string>>().notNull(),
		results: jsonb('results').$type<QuestionResult[]>().notNull(),
		score: smallint('score').notNull(),
		passed: boolean('passed').notNull(),
		summary: jsonb('summary').$type<AttemptSummary>().notNull(),
		durationSeconds: smallint('duration_seconds'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('assessment_attempts_user_idx').on(t.userId, t.assessmentId, t.createdAt)]
);
