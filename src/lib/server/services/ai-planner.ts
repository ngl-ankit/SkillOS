import { and, desc, eq, sql } from 'drizzle-orm';
import { addDaysISO, clamp, humanMinutes } from '$lib/utils';
import { db } from '../db';
import { aiCache, aiConversations, aiMessages, dailyPlanItems, dailyPlans } from '../db/schema';
import { composePlan } from '../engine/planner';
import type { PlanItemKind } from '../engine/types';
import { getPreferences, requireProfile, todayPlan } from './access';
import { persistPlan } from './dashboard';
import { buildLearnerContext, contextToPrompt, rememberFact } from './learner-context';
import { revisionQueue, weakTopics } from './progress';
import { generate, parseJson } from '../ai/client';
import { logger } from '../logger';

const PLAN_SYSTEM = `You are the planning engine inside SkillOS, a personal learning operating system.
You receive a deterministic draft plan already computed from the learner's real data, plus that learner's full context.
Your job is to refine the draft — reorder, reword, or replace at most one item, and write one short coaching note.

Rules:
- Never exceed the learner's time budget. The sum of item minutes must stay within 5 minutes of the draft total.
- Keep every item actionable in a single sitting. No item may exceed 90 minutes.
- Never invent topics, resources or assessments that are not in the learner's roadmap.
- Prefer finishing something started over opening something new.
- The note must be 1–2 sentences, concrete and specific, addressed to the learner by name. No greetings, no praise, no emoji.
- If the draft already looks right, return it unchanged with a good note.

Respond with JSON only:
{"focus": string, "note": string, "items": [{"kind": "learn"|"practice"|"assess"|"revise"|"project"|"carry_over", "title": string, "detail": string, "minutes": number, "topicTitle": string | null}]}`;

export type PlanRefinement = {
	focus: string;
	note: string;
	items: { kind: PlanItemKind; title: string; detail: string; minutes: number; topicTitle: string | null }[];
};

const KINDS: PlanItemKind[] = ['learn', 'practice', 'assess', 'revise', 'project', 'carry_over'];

function sanitizeRefinement(raw: unknown, budget: number, fallback: { focus: string; items: { kind: PlanItemKind; title: string; detail: string; minutes: number }[] }): PlanRefinement | null {
	if (!raw || typeof raw !== 'object') return null;
	const value = raw as Record<string, unknown>;
	const itemsRaw = Array.isArray(value.items) ? value.items : [];
	const items: PlanRefinement['items'] = [];
	for (const entry of itemsRaw) {
		if (!entry || typeof entry !== 'object') continue;
		const item = entry as Record<string, unknown>;
		const kind = typeof item.kind === 'string' && KINDS.includes(item.kind as PlanItemKind) ? (item.kind as PlanItemKind) : null;
		const title = typeof item.title === 'string' ? item.title.trim().slice(0, 140) : '';
		const minutes = typeof item.minutes === 'number' ? clamp(Math.round(item.minutes), 5, 90) : 0;
		if (!kind || title.length < 3 || minutes === 0) continue;
		items.push({
			kind,
			title,
			detail: typeof item.detail === 'string' ? item.detail.trim().slice(0, 320) : '',
			minutes,
			topicTitle: typeof item.topicTitle === 'string' ? item.topicTitle : null
		});
		if (items.length >= 8) break;
	}
	if (items.length === 0) return null;
	const total = items.reduce((sum, i) => sum + i.minutes, 0);
	// Reject plans that ignore the budget; the deterministic draft is better than a fantasy.
	if (total > budget + 5 || total < Math.min(10, budget)) return null;
	const scaled = total > budget ? items.map((i) => ({ ...i, minutes: Math.max(5, Math.round((i.minutes * budget) / total)) })) : items;
	return {
		focus: typeof value.focus === 'string' && value.focus.trim().length > 2 ? value.focus.trim().slice(0, 140) : fallback.focus,
		note: typeof value.note === 'string' ? value.note.trim().slice(0, 320) : '',
		items: scaled
	};
}

/**
 * Produces today's plan. The deterministic engine is always the source of
 * truth; Grok may only refine it, and its output is validated before it is used.
 */
export async function planWithAi(userId: string, today: string, force: boolean): Promise<{ planId: string; refined: boolean; note: string | null }> {
	const existing = await todayPlan(userId, today);
	if (existing && !force) {
		return { planId: existing.plan.id, refined: Boolean(existing.plan.aiNote), note: existing.plan.aiNote };
	}

	const profile = await requireProfile(userId);
	const prefs = await getPreferences(userId);
	const context = await buildLearnerContext(userId, today);
	const revision = await revisionQueue(userId, today);
	const weak = await weakTopics(userId, 8);

	// Rebuild deterministically first so the AI never sees stale state.
	const { ensureTodayPlan } = await import('./dashboard');
	void ensureTodayPlan;
	const deterministic = await todayPlan(userId, today);
	if (deterministic && !force) return { planId: deterministic.plan.id, refined: Boolean(deterministic.plan.aiNote), note: deterministic.plan.aiNote };

	const draftSource = context
		? composePlan({
				budgetMinutes: clamp(Math.round(profile.dailyMinutes * (clamp(prefs.intensity, 50, 150) / 100)), 10, 600),
				goalTitle: context.goal?.title ?? 'Your goal',
				topics: [],
				dueReviews: [],
				weakTopics: [],
				carryOver: [],
				activeProject: context.project
					? { id: '', title: context.project.title, nextMilestone: context.project.nextMilestone, minutesPerDay: 45 }
					: null,
				learningStyle: profile.learningStyle,
				level: profile.level,
				adaptation: { intensity: prefs.intensity, reviewBias: 0 },
				hasAssessment: revision.length > 0
			})
		: null;
	void draftSource;
	void weak;

	// Compose from persisted roadmap state, then persist, then optionally refine.
	const { planId } = await ensureTodayPlanNow(userId, today, force);
	const planRow = await todayPlan(userId, today);
	if (!planRow) return { planId, refined: false, note: null };

	if (!context) return { planId, refined: false, note: null };

	const draft = {
		focus: planRow.plan.focus,
		budget: planRow.plan.plannedMinutes,
		items: planRow.items.map((i) => ({ kind: i.kind as PlanItemKind, title: i.title, detail: i.detail, minutes: i.minutes }))
	};

	const cacheKey = `plan:${today}:${planRow.items.map((i) => i.id).join(',')}`;
	const cached = await readCache<PlanRefinement>(userId, cacheKey);
	const refinement =
		cached ??
		sanitizeRefinement(
			parseJson(
				(
					await generate({
						system: PLAN_SYSTEM,
						prompt: `${contextToPrompt(context)}

DRAFT PLAN (${draft.budget} min total, focus "${draft.focus}")
${draft.items.map((i, n) => `${n + 1}. [${i.kind}] ${i.title} — ${i.minutes} min. ${i.detail}`).join('\n')}

Refine this into the final plan.`,
						maxOutputTokens: 900,
						temperature: 0.4
					})
				)?.text
			),
			draft.budget,
			draft
		);

	if (!refinement) {
		// Deterministic plan stands; record why so the UI can be honest about it.
		logger.info('ai.plan_not_refined', { userId, day: today });
		return { planId, refined: false, note: null };
	}

	await writeCache(userId, cacheKey, refinement, 60 * 60 * 12);

	await persistPlan(
		userId,
		planRow.plan.goalId,
		today,
		{
			focus: refinement.focus,
			budgetMinutes: planRow.plan.budgetMinutes,
			plannedMinutes: refinement.items.reduce((sum, i) => sum + i.minutes, 0),
			rationale: planRow.plan.rationale,
			items: refinement.items.map((item, index) => ({
				position: index + 1,
				kind: item.kind,
				title: item.title,
				detail: item.detail,
				minutes: item.minutes,
				ref: item.topicTitle
					? { topicId: planRow.items.find((r) => r.title.includes(item.topicTitle ?? '\u0000'))?.ref?.topicId }
					: (planRow.items[index]?.ref ?? {})
			}))
		},
		true
	);

	if (refinement.note) {
		await db.update(dailyPlans).set({ aiNote: refinement.note, updatedAt: new Date() }).where(eq(dailyPlans.id, planId));
		try {
			await rememberFact({
				userId,
				kind: 'preference',
				key: `plan-focus-${today}`,
				content: refinement.note,
				source: 'progress',
				confidence: 45
			});
		} catch {
			// Memory is best-effort; a failure must never break planning.
		}
	}

	logger.info('ai.plan_refined', { userId, day: today, items: refinement.items.length });
	return { planId, refined: true, note: refinement.note || null };
}

/** Local import shim so the plan can be composed with the real roadmap snapshots. */
async function ensureTodayPlanNow(userId: string, today: string, force: boolean): Promise<{ planId: string }> {
	const mod = await import('./dashboard');
	const result = await mod.ensureTodayPlan(userId, today, force);
	return { planId: result.planId };
}

export async function readCache<T>(userId: string, key: string): Promise<T | null> {
	const [row] = await db
		.select()
		.from(aiCache)
		.where(and(eq(aiCache.userId, userId), eq(aiCache.key, key), sql`${aiCache.expiresAt} > now()`))
		.orderBy(desc(aiCache.createdAt))
		.limit(1);
	if (!row) return null;
	return row.content as T;
}

export async function writeCache(userId: string, key: string, content: unknown, ttlSeconds: number) {
	await db
		.insert(aiCache)
		.values({
			userId,
			key: key.slice(0, 240),
			content: content as Record<string, unknown>,
			expiresAt: new Date(Date.now() + ttlSeconds * 1000)
		})
		.onConflictDoNothing();
}

/** Appends both sides of a mentor exchange so conversations stay resumable. */
export async function appendMessages(userId: string, conversationId: string, entries: { role: 'user' | 'assistant'; content: string }[]) {
	if (entries.length === 0) return;
	await db.insert(aiMessages).values(
		entries.map((entry) => ({
			conversationId,
			userId,
			role: entry.role,
			content: entry.content.slice(0, 20_000)
		}))
	);
	await db.update(aiConversations).set({ updatedAt: new Date() }).where(eq(aiConversations.id, conversationId));
}

export { addDaysISO, humanMinutes };

void dailyPlanItems;
