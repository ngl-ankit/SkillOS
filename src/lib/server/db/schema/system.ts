import { sql } from 'drizzle-orm';
import { boolean, index, jsonb, pgTable, smallint, text, timestamp, uniqueIndex, uuid, vector } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { jobStatusEnum, notificationKindEnum } from './enums';
import { tsvector } from './types';

export const notifications = pgTable(
	'notifications',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		kind: notificationKindEnum('kind').notNull(),
		title: text('title').notNull(),
		body: text('body').notNull().default(''),
		href: text('href'),
		/** Prevents duplicate reminders, e.g. "daily:2026-09-23". */
		dedupeKey: text('dedupe_key').notNull(),
		read: boolean('read').notNull().default(false),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('notifications_user_dedupe_uq').on(t.userId, t.dedupeKey),
		index('notifications_user_unread_idx').on(t.userId, t.read, t.createdAt)
	]
);

export const EMBEDDING_DIMENSIONS = 256;

/**
 * Unified search index: Postgres full-text search plus a locally computed
 * pgvector embedding (no external embedding API). user_id NULL = shared library.
 */
export const searchDocuments = pgTable(
	'search_documents',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
		entityType: text('entity_type', { enum: ['topic', 'resource', 'project', 'note', 'assessment'] }).notNull(),
		entityId: uuid('entity_id').notNull(),
		title: text('title').notNull(),
		body: text('body').notNull().default(''),
		href: text('href').notNull(),
		embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
		searchVector: tsvector('search_vector').generatedAlwaysAs(
			sql`setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(body, '')), 'B')`
		),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('search_documents_entity_uq').on(t.entityType, t.entityId),
		index('search_documents_user_idx').on(t.userId),
		index('search_documents_fts_idx').using('gin', t.searchVector),
		index('search_documents_embedding_idx').using('hnsw', t.embedding.op('vector_cosine_ops'))
	]
);

/** Tracks background work (Trigger.dev or in-process) for status, retries and idempotency. */
export const backgroundJobs = pgTable(
	'background_jobs',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		kind: text('kind').notNull(),
		idempotencyKey: text('idempotency_key').notNull(),
		status: jobStatusEnum('status').notNull().default('queued'),
		attempts: smallint('attempts').notNull().default(0),
		payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
		result: jsonb('result').$type<Record<string, unknown>>(),
		error: text('error'),
		runner: text('runner', { enum: ['trigger', 'inline'] }).notNull().default('inline'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('background_jobs_idempotency_uq').on(t.userId, t.idempotencyKey),
		index('background_jobs_status_idx').on(t.status, t.createdAt)
	]
);

/** Fixed-window rate limiting stored in Postgres (works across instances). */
export const rateLimits = pgTable('rate_limits', {
	key: text('key').primaryKey(),
	count: smallint('count').notNull().default(0),
	windowStart: timestamp('window_start', { withTimezone: true }).notNull().defaultNow()
});
