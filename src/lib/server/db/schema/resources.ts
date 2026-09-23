import { index, integer, pgTable, primaryKey, smallint, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { resourceCostEnum, resourceRoleEnum, resourceTypeEnum, savedStatusEnum } from './enums';
import { topics } from './roadmap';

/** Curated, shared resource library. URLs come only from the verified catalog. */
export const resources = pgTable(
	'resources',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		slug: text('slug').notNull().unique(),
		title: text('title').notNull(),
		url: text('url').notNull(),
		provider: text('provider').notNull(),
		type: resourceTypeEnum('type').notNull(),
		difficulty: smallint('difficulty').notNull(),
		cost: resourceCostEnum('cost').notNull(),
		estimatedMinutes: integer('estimated_minutes').notNull(),
		prerequisites: text('prerequisites').notNull().default(''),
		description: text('description').notNull(),
		whyUseful: text('why_useful').notNull(),
		tags: text('tags').array().notNull().default([]),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('resources_type_idx').on(t.type)]
);

export const topicResources = pgTable(
	'topic_resources',
	{
		topicId: uuid('topic_id')
			.notNull()
			.references(() => topics.id, { onDelete: 'cascade' }),
		resourceId: uuid('resource_id')
			.notNull()
			.references(() => resources.id, { onDelete: 'cascade' }),
		role: resourceRoleEnum('role').notNull(),
		position: smallint('position').notNull().default(0)
	},
	(t) => [primaryKey({ columns: [t.topicId, t.resourceId] }), index('topic_resources_resource_idx').on(t.resourceId)]
);

export const savedResources = pgTable(
	'saved_resources',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		resourceId: uuid('resource_id')
			.notNull()
			.references(() => resources.id, { onDelete: 'cascade' }),
		status: savedStatusEnum('status').notNull().default('saved'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [uniqueIndex('saved_resources_user_resource_uq').on(t.userId, t.resourceId)]
);
