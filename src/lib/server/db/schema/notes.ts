import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { learningSessions } from './activity';
import { users } from './auth';
import { projects } from './projects';
import { resources } from './resources';
import { topics } from './roadmap';
import { tsvector } from './types';

export const notes = pgTable(
	'notes',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		body: text('body').notNull().default(''),
		topicId: uuid('topic_id').references(() => topics.id, { onDelete: 'set null' }),
		resourceId: uuid('resource_id').references(() => resources.id, { onDelete: 'set null' }),
		projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
		sessionId: uuid('session_id').references(() => learningSessions.id, { onDelete: 'set null' }),
		searchVector: tsvector('search_vector').generatedAlwaysAs(
			sql`to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))`
		),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('notes_user_idx').on(t.userId, t.updatedAt),
		index('notes_topic_idx').on(t.topicId),
		index('notes_search_idx').using('gin', t.searchVector),
		check('notes_title_len', sql`char_length(${t.title}) between 1 and 200`)
	]
);
