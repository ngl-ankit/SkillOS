import { PROJECTS } from './projects';
import { RESOURCE_BY_SLUG, RESOURCES } from './resources';
import { BACKEND_TOPICS } from './topics/backend';
import { CS_TOPICS } from './topics/cs';
import { DATA_AI_TOPICS } from './topics/data-ai';
import { DESIGN_BUSINESS_TOPICS } from './topics/design-business';
import { JS_TOPICS } from './topics/javascript';
import { WEB_TOPICS } from './topics/web';
import { TRACKS } from './tracks';
import type { CatalogTrack } from './types';

export const TOPICS = [
	...WEB_TOPICS,
	...JS_TOPICS,
	...BACKEND_TOPICS,
	...DATA_AI_TOPICS,
	...CS_TOPICS,
	...DESIGN_BUSINESS_TOPICS
];

export const TOPIC_BY_KEY = new Map(TOPICS.map((t) => [t.key, t]));
export const PROJECT_BY_KEY = new Map(PROJECTS.map((p) => [p.key, p]));
export const TRACK_BY_SLUG = new Map(TRACKS.map((t) => [t.slug, t]));

export type * from './types';
export { PROJECTS, RESOURCE_BY_SLUG, RESOURCES, TRACKS };

/** Returns true if every prerequisite is placed before the topic in the track order. */
export function trackOrderIsValid(track: CatalogTrack): boolean {
	const order = track.phases.flatMap((p) => p.topics);
	const index = new Map(order.map((k, i) => [k, i]));
	return order.every((k, i) =>
		(TOPIC_BY_KEY.get(k)?.prerequisites ?? []).every((p) => (index.get(p) ?? Number.POSITIVE_INFINITY) < i)
	);
}

/**
 * Validates referential integrity of the catalog. Returns a list of problems
 * (empty when valid). Enforced by unit tests so broken content never ships.
 */
export function validateCatalog(): string[] {
	const problems: string[] = [];
	const seen = new Set<string>();
	for (const t of TOPICS) {
		if (seen.has(t.key)) problems.push(`duplicate topic ${t.key}`);
		seen.add(t.key);
		for (const p of t.prerequisites) if (!TOPIC_BY_KEY.has(p)) problems.push(`${t.key}: unknown prerequisite ${p}`);
		for (const slug of Object.values(t.resources))
			if (slug && !RESOURCE_BY_SLUG.has(slug)) problems.push(`${t.key}: unknown resource ${slug}`);
		if (t.questions.length < 2) problems.push(`${t.key}: needs at least 2 questions`);
		for (const q of t.questions) {
			if (q.type === 'mcq' && (!q.options || !['a', 'b', 'c', 'd'].slice(0, q.options.length).includes(q.answer)))
				problems.push(`${t.key}: invalid mcq answer "${q.prompt}"`);
			if (q.type === 'true_false' && !['true', 'false'].includes(q.answer)) problems.push(`${t.key}: invalid true/false answer`);
			if ((q.type === 'short' || q.type === 'code') && !q.keywords?.length)
				problems.push(`${t.key}: free-text question without keywords`);
			for (const k of q.keywords ?? []) {
				try {
					new RegExp(k, 'i');
				} catch {
					problems.push(`${t.key}: invalid keyword regex ${k}`);
				}
			}
		}
	}
	for (const p of PROJECTS) if (!TOPIC_BY_KEY.has(p.topicKey)) problems.push(`project ${p.key}: unknown topic ${p.topicKey}`);
	for (const track of TRACKS) {
		const included = new Set(track.phases.flatMap((ph) => ph.topics));
		for (const ph of track.phases) {
			for (const key of ph.topics) if (!TOPIC_BY_KEY.has(key)) problems.push(`track ${track.slug}: unknown topic ${key}`);
			if (ph.project && !PROJECT_BY_KEY.has(ph.project)) problems.push(`track ${track.slug}: unknown project ${ph.project}`);
		}
		for (const key of included)
			for (const pre of TOPIC_BY_KEY.get(key)?.prerequisites ?? [])
				if (!included.has(pre)) problems.push(`track ${track.slug}: ${key} needs ${pre} which is missing`);
		if (!trackOrderIsValid(track)) problems.push(`track ${track.slug}: prerequisites out of order`);
	}
	return problems;
}
