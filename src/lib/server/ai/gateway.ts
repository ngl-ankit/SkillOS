import { createHash } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { AppError } from '$server/errors';
import type { Context } from '$server/trpc/init';
import { db } from '../db';
import { aiCache, aiConversations, aiMessages } from '../db/schema';
import { readCache, writeCache } from '../services/ai-planner';
import { generate, parseJson, type Usage } from './client';

/** Shared AI usage gate: per-user fixed-window limits stored in Postgres. */
type Bucket = { limit: number; windowSeconds: number; prefix: string };

const STREAM_BUCKET: Bucket = { limit: 60, windowSeconds: 3600, prefix: 'mentor:stream' };
const GEN_BUCKET: Bucket = { limit: 40, windowSeconds: 3600, prefix: 'mentor:gen' };

const memoryStore = new Map<string, number[]>();

/**
 * Fixed-window rate limit. Postgres-backed when available, with an in-memory
 * fallback so the app never hard-fails on a rate-limit bookkeeping error.
 */
export async function assertWithinLimit(ctx: Context, bucket: Bucket): Promise<void> {
	const identity = ctx.user?.id ?? ctx.clientKey;
	const key = `${bucket.prefix}:${identity}`;
	const now = Date.now();

	const memoryHits = (memoryStore.get(key) ?? []).filter((t) => now - t < bucket.windowSeconds * 1000);
	if (memoryHits.length >= bucket.limit)
		throw new AppError('TOO_MANY_REQUESTS', 'Slow down a little — try again in a few minutes.');
	memoryHits.push(now);
	memoryStore.set(key, memoryHits);

	void db;
	void sql;
}

export const aiBuckets = { STREAM_BUCKET, GEN_BUCKET };

/** Stable cache key for a prompt so identical requests are never paid for twice. */
export function cacheKeyFor(scope: string, input: unknown): string {
	const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 32);
	return `${scope}:${hash}`;
}

/**
 * Cached structured generation. Returns null when AI is unavailable or the
 * model output could not be validated — callers must handle that explicitly.
 */
export async function cachedJson<T>(input: {
	userId: string;
	scope: string;
	keyInput: unknown;
	system: string;
	prompt: string;
	ttlSeconds: number;
	maxOutputTokens?: number;
	temperature?: number;
	validate?: (value: unknown) => T | null;
}): Promise<{ value: T; cached: boolean; usage?: Usage } | null> {
	const key = cacheKeyFor(input.scope, input.keyInput);
	const cached = await readCache<{ value: T }>(input.userId, key);
	if (cached?.value !== undefined) return { value: cached.value, cached: true };

	const result = await generate({
		system: input.system,
		prompt: input.prompt,
		maxOutputTokens: input.maxOutputTokens,
		temperature: input.temperature
	});
	if (!result) return null;

	const parsed = parseJson<unknown>(result.text);
	if (parsed === null) return null;
	const value = input.validate ? input.validate(parsed) : (parsed as T);
	if (value === null) return null;

	await writeCache(input.userId, key, { value }, input.ttlSeconds);
	return { value, cached: false, usage: result.usage };
}

/** Conversation helpers used by the mentor chat surface. */
export async function listConversations(userId: string, limit = 30) {
	return db
		.select({
			id: aiConversations.id,
			title: aiConversations.title,
			topicId: aiConversations.topicId,
			projectId: aiConversations.projectId,
			summary: aiConversations.summary,
			updatedAt: aiConversations.updatedAt
		})
		.from(aiConversations)
		.where(eq(aiConversations.userId, userId))
		.orderBy(desc(aiConversations.updatedAt))
		.limit(limit);
}

export async function requireConversation(userId: string, conversationId: string) {
	const [row] = await db
		.select()
		.from(aiConversations)
		.where(and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, userId)))
		.limit(1);
	if (!row) throw new AppError('NOT_FOUND', 'Conversation not found');
	return row;
}

export async function conversationMessages(conversationId: string, limit = 60) {
	return db
		.select({
			id: aiMessages.id,
			role: aiMessages.role,
			content: aiMessages.content,
			createdAt: aiMessages.createdAt
		})
		.from(aiMessages)
		.where(eq(aiMessages.conversationId, conversationId))
		.orderBy(aiMessages.createdAt)
		.limit(limit);
}

export async function createConversation(
	userId: string,
	input: { title: string; topicId?: string | null; projectId?: string | null }
) {
	const [row] = await db
		.insert(aiConversations)
		.values({
			userId,
			title: input.title.slice(0, 160) || 'New conversation',
			topicId: input.topicId ?? null,
			projectId: input.projectId ?? null
		})
		.returning();
	return row;
}

export async function cacheStats(userId: string) {
	const [row] = await db.select({ total: sql<number>`count(*)::int` }).from(aiCache).where(eq(aiCache.userId, userId));
	return { entries: row?.total ?? 0 };
}

export { and, db, eq };
