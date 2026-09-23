import { index, jsonb, pgTable, real, smallint, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { memoryKindEnum, memorySourceEnum, messageRoleEnum } from './enums';
import { projects } from './projects';
import { topics } from './roadmap';

export const aiConversations = pgTable(
	'ai_conversations',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		topicId: uuid('topic_id').references(() => topics.id, { onDelete: 'set null' }),
		projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
		/** Rolling summary of older turns so long threads stay within context. */
		summary: text('summary'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('ai_conversations_user_idx').on(t.userId, t.updatedAt)]
);

export const aiMessages = pgTable(
	'ai_messages',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		conversationId: uuid('conversation_id')
			.notNull()
			.references(() => aiConversations.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		role: messageRoleEnum('role').notNull(),
		content: text('content').notNull(),
		model: text('model'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('ai_messages_conversation_idx').on(t.conversationId, t.createdAt)]
);

/** Structured learner memory. One row per distinct fact, reinforced over time. */
export const aiMemory = pgTable(
	'ai_memory',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		kind: memoryKindEnum('kind').notNull(),
		/** Normalised key, e.g. "concept:closures", used for upserts. */
		key: text('key').notNull(),
		content: text('content').notNull(),
		topicId: uuid('topic_id').references(() => topics.id, { onDelete: 'set null' }),
		source: memorySourceEnum('source').notNull(),
		confidence: real('confidence').notNull().default(0.6),
		evidence: jsonb('evidence').$type<string[]>().notNull().default([]),
		timesObserved: smallint('times_observed').notNull().default(1),
		lastObservedAt: timestamp('last_observed_at', { withTimezone: true }).notNull().defaultNow(),
		resolvedAt: timestamp('resolved_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [uniqueIndex('ai_memory_user_kind_key_uq').on(t.userId, t.kind, t.key), index('ai_memory_user_idx').on(t.userId, t.kind)]
);

/** Cache of generated AI artefacts so identical requests are never regenerated. */
export const aiCache = pgTable(
	'ai_cache',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		key: text('key').notNull(),
		content: text('content').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [uniqueIndex('ai_cache_user_key_uq').on(t.userId, t.key)]
);
