import { index, jsonb, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { contentSourceEnum, projectStatusEnum } from './enums';
import { roadmapPhases, roadmaps, topics } from './roadmap';
import type { ProjectMilestone } from './types';

export const projects = pgTable(
	'projects',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		roadmapId: uuid('roadmap_id').references(() => roadmaps.id, { onDelete: 'cascade' }),
		phaseId: uuid('phase_id').references(() => roadmapPhases.id, { onDelete: 'set null' }),
		topicId: uuid('topic_id').references(() => topics.id, { onDelete: 'set null' }),
		title: text('title').notNull(),
		goal: text('goal').notNull(),
		difficulty: smallint('difficulty').notNull(),
		concepts: text('concepts').array().notNull().default([]),
		requirements: text('requirements').array().notNull().default([]),
		suggestedStack: text('suggested_stack').array().notNull().default([]),
		milestones: jsonb('milestones').$type<ProjectMilestone[]>().notNull().default([]),
		estimatedHours: smallint('estimated_hours').notNull().default(4),
		source: contentSourceEnum('source').notNull().default('catalog'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('projects_user_idx').on(t.userId), index('projects_topic_idx').on(t.topicId)]
);

export const projectProgress = pgTable(
	'project_progress',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		projectId: uuid('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		status: projectStatusEnum('status').notNull().default('not_started'),
		completedMilestones: smallint('completed_milestones').array().notNull().default([]),
		repoUrl: text('repo_url'),
		reflection: text('reflection'),
		startedAt: timestamp('started_at', { withTimezone: true }),
		completedAt: timestamp('completed_at', { withTimezone: true }),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [uniqueIndex('project_progress_user_project_uq').on(t.userId, t.projectId)]
);
