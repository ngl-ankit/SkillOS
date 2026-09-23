import { and, eq, inArray, sql } from 'drizzle-orm';
import { PROJECT_BY_KEY, TOPIC_BY_KEY, TRACKS, TRACK_BY_SLUG } from '../catalog';
import type { CatalogTopic, CatalogTrack } from '../catalog/types';
import { db } from '../db';
import { projects, roadmapPhases, roadmaps, topicPrerequisites, topicProgress, topics } from '../db/schema';
import { logger } from '../logger';
import { slugify } from '$lib/utils';
import type { BlueprintPhase, BlueprintTopic, RoadmapBlueprint } from './types';

const STOP_WORDS = new Set([
	'learn',
	'learning',
	'want',
	'wanna',
	'become',
	'becoming',
	'get',
	'good',
	'better',
	'improve',
	'improving',
	'master',
	'mastering',
	'i',
	'me',
	'my',
	'a',
	'an',
	'the',
	'to',
	'in',
	'on',
	'for',
	'with',
	'and',
	'from',
	'as',
	'at',
	'of',
	'how',
	'do',
	'skill',
	'skills',
	'journey',
	'roadmap',
	'career',
	'job',
	'role',
	'work',
	'working',
	'professional',
	'deeply',
	'basics',
	'fundamentals',
	'start',
	'beginner'
]);

export function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.split(/[^a-z0-9+#.]+/)
		.map((t) => t.replace(/^\.+|\.+$/g, ''))
		.filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/** Scores every curated track against the learner's stated goal and target role. */
export function rankTracks(goalTitle: string, targetRole: string | null, skills: string[]): { track: CatalogTrack; score: number }[] {
	const goalTokens = new Set(tokenize(`${goalTitle} ${targetRole ?? ''}`));
	const skillTokens = new Set(skills.flatMap((s) => tokenize(s)));
	const results = TRACKS.map((track) => {
		let score = 0;
		for (const keyword of track.keywords) {
			const k = keyword.toLowerCase();
			for (const token of goalTokens) {
				if (token === k) score += 6;
				else if (token.includes(k) || k.includes(token)) score += 3;
			}
			if (skillTokens.has(k)) score += 1;
		}
		for (const token of goalTokens) {
			if (track.title.toLowerCase().includes(token)) score += 4;
			if (track.summary.toLowerCase().includes(token)) score += 1;
		}
		return { track, score };
	});
	return results.sort((a, b) => b.score - a.score || a.track.title.localeCompare(b.track.title));
}

export function pickTrack(goalTitle: string, targetRole: string | null, skills: string[], explicitSlug?: string | null): CatalogTrack {
	if (explicitSlug) {
		const found = TRACK_BY_SLUG.get(explicitSlug);
		if (found) return found;
	}
	const ranked = rankTracks(goalTitle, targetRole, skills);
	if (ranked[0] && ranked[0].score > 0) return ranked[0].track;
	// Fall back to the most universally useful starting track.
	return TRACK_BY_SLUG.get('web-development') ?? ranked[0]?.track ?? TRACKS[0];
}

/** True when the learner's declared skills already cover the topic's headline skill tags. */
function isCovered(topic: CatalogTopic, skills: string[]): boolean {
	if (skills.length === 0) return false;
	const cover = 1 + Math.floor(topic.skills.length / 2);
	const matched = topic.skills.filter((s) => skills.some((owned) => owned.toLowerCase() === s.toLowerCase())).length;
	return matched >= Math.min(cover, topic.skills.length) && topic.skills.length > 0;
}

type SelectOptions = {
	level: 'beginner' | 'intermediate' | 'advanced';
	skills: string[];
	dailyMinutes: number;
	deadline: string | null;
	today?: string;
};

/**
 * Builds the ordered roadmap. Rules:
 *  - topics arrive in track order, which the catalog guarantees is prerequisite-safe
 *  - intermediate/advanced learners skip topics their declared skills already cover
 *  - a tight deadline drops topics that nothing later depends on, never prerequisites
 */
export function buildBlueprint(track: CatalogTrack, goalTitle: string, options: SelectOptions): RoadmapBlueprint {
	const order = track.phases.flatMap((phase) => phase.topics);
	const orderIndex = new Map(order.map((key, index) => [key, index]));
	const skipped: string[] = [];
	const included = new Set<string>();

	// Pass 1 — decide inclusion.
	const eligible: string[] = [];
	for (const key of order) {
		const topic = TOPIC_BY_KEY.get(key);
		if (!topic) continue;
		const covered = isCovered(topic, options.skills);
		if (covered && options.level !== 'beginner' && topic.difficulty <= 3) {
			skipped.push(key);
			continue;
		}
		if (options.level === 'advanced' && topic.difficulty <= 1) {
			skipped.push(key);
			continue;
		}
		eligible.push(key);
	}

	// Pass 2 — deadline pressure. Only trim topics that are not a prerequisite of a kept topic.
	let kept = eligible;
	if (options.deadline) {
		const today = options.today ?? new Date().toISOString().slice(0, 10);
		const days = Math.max(1, Math.round((Date.parse(`${options.deadline}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000));
		// Realistic capacity: 70% of budgeted minutes on study, the rest lost to life.
		const capacity = days * options.dailyMinutes * 0.7;
		const totalMinutes = eligible.reduce((sum, key) => sum + (TOPIC_BY_KEY.get(key)?.minutes ?? 0), 0);
		if (totalMinutes > capacity) {
			const required = new Set<string>();
			for (const key of eligible) {
				const topic = TOPIC_BY_KEY.get(key);
				for (const pre of topic?.prerequisites ?? []) {
					if (!skipped.includes(pre)) required.add(pre);
				}
			}
			let budget = capacity;
			const trimmed: string[] = [];
			for (const key of eligible) {
				const topic = TOPIC_BY_KEY.get(key);
				if (!topic) continue;
				if (required.has(key) || budget >= topic.minutes) {
					trimmed.push(key);
					budget -= topic.minutes;
				} else {
					skipped.push(key);
				}
			}
			kept = trimmed;
		}
	}

	for (const key of kept) included.add(key);

	// Prerequisites must exist in the blueprint, or the topic moves forward with the gap flagged.
	for (const key of kept) {
		const topic = TOPIC_BY_KEY.get(key);
		for (const pre of topic?.prerequisites ?? []) {
			if (!included.has(pre)) included.add(pre);
		}
	}

	// Re-derive track order after the closure so positions stay prerequisite-safe.
	const finalOrder = [...included].sort((a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0));

	const phases: BlueprintPhase[] = [];
	let position = 0;
	for (const phase of track.phases) {
		const phaseTopics: BlueprintTopic[] = [];
		for (const key of finalOrder) {
			if (!phase.topics.includes(key)) continue;
			const topic = TOPIC_BY_KEY.get(key);
			if (!topic) continue;
			position += 1;
			phaseTopics.push({
				catalogKey: topic.key,
				slug: slugify(`${topic.key}-${position}`),
				title: topic.title,
				description: topic.description,
				domain: topic.domain,
				difficulty: topic.difficulty,
				estimatedMinutes: topic.minutes,
				concepts: topic.concepts,
				practice: topic.practice.map((p) => ({ ...p })),
				prerequisites: topic.prerequisites.filter((p) => included.has(p)),
				priorKnowledge: isCovered(topic, options.skills) && options.level !== 'beginner'
			});
		}
		if (phaseTopics.length === 0) continue;
		phases.push({
			title: phase.title,
			description: phase.description,
			milestone: { ...phase.milestone },
			topics: phaseTopics,
			projectKey: phase.project && PROJECT_BY_KEY.has(phase.project) ? phase.project : undefined
		});
	}

	// A track with no requested phase content still needs one usable phase.
	if (phases.length === 0) {
		phases.push({
			title: track.title,
			description: track.summary,
			milestone: { title: `Complete ${track.title}`, detail: 'Work through the topics and finish the phase project.' },
			topics: [],
			projectKey: undefined
		});
	}

	const totalMinutes = phases.flatMap((p) => p.topics).reduce((sum, t) => sum + t.estimatedMinutes, 0);
	const weeks = Math.max(1, Math.round(totalMinutes / Math.max(30, options.dailyMinutes) / 5));
	const summary = `${phases.flatMap((p) => p.topics).length} topics across ${phases.length} phases · about ${weeks} ${weeks === 1 ? 'week' : 'weeks'} at ${options.dailyMinutes} min/day.`;

	return { title: goalTitle, summary, trackSlug: track.slug, phases, skipped };
}

export type PersistResult = {
	roadmapId: string;
	phaseIds: string[];
	topicIdsByCatalogKey: Map<string, string>;
};

/**
 * Writes a blueprint to the database atomically, replacing any previous
 * non-archived roadmap for the same goal.
 */
export async function persistBlueprint(
	userId: string,
	goalId: string,
	blueprint: RoadmapBlueprint,
	options: { source?: 'catalog' | 'engine' | 'ai'; version?: number } = {}
): Promise<PersistResult> {
	return db.transaction(async (tx) => {
		await tx
			.update(roadmaps)
			.set({ status: 'archived', updatedAt: new Date() })
			.where(and(eq(roadmaps.userId, userId), eq(roadmaps.goalId, goalId), sql`${roadmaps.status} <> 'archived'`));

		const [roadmap] = await tx
			.insert(roadmaps)
			.values({
				userId,
				goalId,
				title: blueprint.title,
				summary: blueprint.summary,
				status: 'ready',
				source: options.source ?? 'catalog',
				version: options.version ?? 1
			})
			.returning({ id: roadmaps.id });

		const phaseIds: string[] = [];
		const topicIdsByCatalogKey = new Map<string, string>();
		const pendingPrerequisites: { topicId: string; catalogKey: string; prerequisites: string[] }[] = [];

		for (const [phaseIndex, phase] of blueprint.phases.entries()) {
			const [row] = await tx
				.insert(roadmapPhases)
				.values({
					roadmapId: roadmap.id,
					position: phaseIndex + 1,
					title: phase.title,
					description: phase.description,
					milestoneTitle: phase.milestone.title,
					milestoneDetail: phase.milestone.detail
				})
				.returning({ id: roadmapPhases.id });
			phaseIds.push(row.id);

			for (const [topicIndex, topic] of phase.topics.entries()) {
				const [inserted] = await tx
					.insert(topics)
					.values({
						userId,
						roadmapId: roadmap.id,
						phaseId: row.id,
						slug: topic.slug,
						catalogKey: topic.catalogKey,
						domain: topic.domain,
						title: topic.title,
						description: topic.description,
						difficulty: topic.difficulty,
						estimatedMinutes: topic.estimatedMinutes,
						position: topicIndex + 1,
						concepts: topic.concepts,
						practice: topic.practice,
						source: 'catalog'
					})
					.returning({ id: topics.id });
				topicIdsByCatalogKey.set(topic.catalogKey, inserted.id);
				pendingPrerequisites.push({
					topicId: inserted.id,
					catalogKey: topic.catalogKey,
					prerequisites: topic.prerequisites
				});

				await tx.insert(topicProgress).values({
					userId,
					topicId: inserted.id,
					status: 'not_started',
					priorKnowledge: topic.priorKnowledge,
					// Topics the learner already knows still surface quickly for a confidence check.
					nextReviewAt: topic.priorKnowledge ? new Date() : null
				});
			}
		}

		// Prerequisite edges, resolved after every topic id is known.
		const edges = pendingPrerequisites.flatMap((entry) =>
			entry.prerequisites
				.map((pre) => topicIdsByCatalogKey.get(pre))
				.filter((preId): preId is string => Boolean(preId))
				.map((preId) => ({ topicId: entry.topicId, prerequisiteId: preId }))
		);
		if (edges.length > 0) await tx.insert(topicPrerequisites).values(edges);

		// Phase projects, anchored to the topic they reinforce.
		for (const [phaseIndex, phase] of blueprint.phases.entries()) {
			if (!phase.projectKey) continue;
			const template = PROJECT_BY_KEY.get(phase.projectKey);
			if (!template) continue;
			const anchorId = topicIdsByCatalogKey.get(template.topicKey) ?? topicIdsByCatalogKey.get(phase.topics[0]?.catalogKey ?? '');
			await tx.insert(projects).values({
				userId,
				roadmapId: roadmap.id,
				phaseId: phaseIds[phaseIndex],
				topicId: anchorId ?? null,
				title: template.title,
				goal: template.goal,
				difficulty: template.difficulty,
				concepts: template.concepts,
				requirements: template.requirements,
				suggestedStack: template.stack,
				milestones: template.milestones,
				estimatedHours: template.hours,
				source: 'catalog'
			});
		}

		logger.info('roadmap.persisted', { userId, roadmapId: roadmap.id, phases: phaseIds.length, topics: topicIdsByCatalogKey.size });
		return { roadmapId: roadmap.id, phaseIds, topicIdsByCatalogKey };
	});
}

/** Convenience wrapper: rank a track, build the blueprint and persist it. */
export async function generateRoadmap(input: {
	userId: string;
	goalId: string;
	goalTitle: string;
	targetRole: string | null;
	level: 'beginner' | 'intermediate' | 'advanced';
	skills: string[];
	dailyMinutes: number;
	deadline: string | null;
	trackSlug?: string | null;
	today?: string;
}): Promise<PersistResult & { blueprint: RoadmapBlueprint }> {
	const track = pickTrack(input.goalTitle, input.targetRole, input.skills, input.trackSlug);
	const blueprint = buildBlueprint(track, input.goalTitle, {
		level: input.level,
		skills: input.skills,
		dailyMinutes: input.dailyMinutes,
		deadline: input.deadline,
		today: input.today
	});
	const result = await persistBlueprint(input.userId, input.goalId, blueprint);
	return { ...result, blueprint };
}

/** Ordered catalog keys of a track — used by tests and the AI planner. */
export function trackOrder(slug: string): string[] {
	return TRACK_BY_SLUG.get(slug)?.phases.flatMap((p) => p.topics) ?? [];
}

export { inArray };
