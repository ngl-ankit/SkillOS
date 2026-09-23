import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { todayISO, truncate } from '$lib/utils';
import { generate } from '$server/ai/client';
import {
	aiBuckets,
	assertWithinLimit,
	cachedJson,
	conversationMessages,
	createConversation,
	listConversations,
	requireConversation
} from '$server/ai/gateway';
import { EXPLAIN_SYSTEM, MENTOR_SYSTEM } from '$server/ai/prompts';
import { db } from '$server/db';
import { aiConversations, aiMessages } from '$server/db/schema';
import { AppError } from '$server/errors';
import { appendMessages } from '$server/services/ai-planner';
import { buildLearnerContext, contextToPrompt } from '$server/services/learner-context';
import { ctx } from '../init';

const OFFLINE_REPLY =
	'The AI mentor is unavailable right now — no XAI_API_KEY is configured or the request failed. ' +
	'Everything else in SkillOS keeps working; set the key and try again.';

/** Composes a mentor prompt grounded in the learner's real context. */
async function mentorPrompt(userId: string, message: string): Promise<string> {
	const lc = await buildLearnerContext(userId, todayISO());
	return lc ? `${contextToPrompt(lc)}\n\nLearner message: ${message}` : message;
}

export const mentorRouter = ctx.router({
	conversations: ctx.protectedProcedure
		.input(z.object({ limit: z.number().int().min(1).max(50).default(20) }))
		.query(async ({ ctx: c, input }) => listConversations(c.user.id, input.limit)),

	messages: ctx.protectedProcedure.input(z.object({ conversationId: z.string().uuid() })).query(async ({ ctx: c, input }) => {
		await requireConversation(c.user.id, input.conversationId);
		return conversationMessages(input.conversationId);
	}),

	newConversation: ctx.protectedProcedure
		.input(
			z.object({
				title: z.string().trim().max(160).default(''),
				topicId: z.string().uuid().nullable().default(null),
				projectId: z.string().uuid().nullable().default(null)
			})
		)
		.mutation(({ ctx: c, input }) =>
			createConversation(c.user.id, {
				title: input.title || 'New conversation',
				topicId: input.topicId,
				projectId: input.projectId
			})
		),

	removeConversation: ctx.protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx: c, input }) => {
		await db.delete(aiConversations).where(and(eq(aiConversations.id, input.id), eq(aiConversations.userId, c.user.id)));
		return { ok: true };
	}),

	/** Single-shot question with the full learner context attached. */
	ask: ctx.protectedProcedure
		.input(z.object({ conversationId: z.string().uuid().nullable().default(null), message: z.string().trim().min(1).max(4000) }))
		.mutation(async ({ ctx: c, input }) => {
			await assertWithinLimit(c, aiBuckets.GEN_BUCKET);
			const convo = input.conversationId
				? await requireConversation(c.user.id, input.conversationId)
				: await createConversation(c.user.id, { title: truncate(input.message, 60) });
			const reply =
				(await generate({ system: MENTOR_SYSTEM, prompt: await mentorPrompt(c.user.id, input.message), maxOutputTokens: 1100 }))
					?.text ?? OFFLINE_REPLY;
			await appendMessages(c.user.id, convo.id, [
				{ role: 'user', content: input.message },
				{ role: 'assistant', content: reply }
			]);
			return { conversationId: convo.id, reply, ai: Boolean(reply !== OFFLINE_REPLY) };
		}),

	/** Cached deep-dive explanation for a concept, with a local fallback. */
	explain: ctx.protectedProcedure
		.input(
			z.object({
				concept: z.string().trim().min(2).max(200),
				topicTitle: z.string().trim().max(200).default(''),
				level: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner')
			})
		)
		.mutation(async ({ ctx: c, input }) => {
			await assertWithinLimit(c, aiBuckets.GEN_BUCKET);
			const result = await cachedJson<{ explanation: string }>({
				userId: c.user.id,
				scope: 'explain',
				keyInput: { concept: input.concept, topic: input.topicTitle, level: input.level },
				system: EXPLAIN_SYSTEM,
				prompt: `Concept: ${input.concept}${input.topicTitle ? `\nTopic: ${input.topicTitle}` : ''}\nLearner level: ${input.level}\nReturn JSON: {"explanation": string} where explanation is 120-220 words, plain prose, no markdown headers.`,
				ttlSeconds: 60 * 60 * 24 * 7,
				validate: (v) =>
					typeof (v as { explanation?: unknown })?.explanation === 'string' ? (v as { explanation: string }) : null
			});
			if (result) return { explanation: result.value.explanation, cached: result.cached, ai: true };
			return {
				explanation:
					`Here is the short version: focus first on what ${input.concept} is for, then the one mechanism that makes it work, then where it breaks down. ` +
					'Work through one concrete example end to end, then explain it back in your own words — that retrieval step is what moves it into long-term memory.',
				cached: false,
				ai: false
			};
		}),

	/** Renames a conversation thread. */
	rename: ctx.protectedProcedure
		.input(z.object({ id: z.string().uuid(), title: z.string().trim().min(1).max(160) }))
		.mutation(async ({ ctx: c, input }) => {
			const [row] = await db
				.update(aiConversations)
				.set({ title: input.title, updatedAt: new Date() })
				.where(and(eq(aiConversations.id, input.id), eq(aiConversations.userId, c.user.id)))
				.returning();
			if (!row) throw new AppError('NOT_FOUND', 'Conversation not found');
			return row;
		}),

	/** Raw history length guard used by the UI before opening a thread. */
	countMessages: ctx.protectedProcedure
		.input(z.object({ conversationId: z.string().uuid() }))
		.query(async ({ ctx: c, input }) => {
			await requireConversation(c.user.id, input.conversationId);
			const rows = await db
				.select({ id: aiMessages.id })
				.from(aiMessages)
				.where(eq(aiMessages.conversationId, input.conversationId))
				.orderBy(desc(aiMessages.createdAt))
				.limit(500);
			return { count: rows.length };
		})
});
