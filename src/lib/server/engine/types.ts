import type { PracticeExercise } from '../db/schema/types';

/** A topic selected from the catalog, ready to be persisted into a learner roadmap. */
export type BlueprintTopic = {
	catalogKey: string;
	slug: string;
	title: string;
	description: string;
	domain: string;
	difficulty: number;
	estimatedMinutes: number;
	concepts: string[];
	practice: PracticeExercise[];
	/** Catalog keys of prerequisites. Always placed earlier in the blueprint. */
	prerequisites: string[];
	/** True when the learner's declared skills already cover this topic. */
	priorKnowledge: boolean;
};

export type BlueprintPhase = {
	title: string;
	description: string;
	milestone: { title: string; detail: string };
	topics: BlueprintTopic[];
	projectKey?: string;
};

export type RoadmapBlueprint = {
	title: string;
	summary: string;
	trackSlug: string;
	phases: BlueprintPhase[];
	/** Topics deliberately left out because the learner already knows them. */
	skipped: string[];
};

/** Compact snapshot of a roadmap topic used by the planning and revision engines. */
export type TopicSnapshot = {
	topicId: string;
	title: string;
	domain: string;
	difficulty: number;
	estimatedMinutes: number;
	position: number;
	phaseTitle: string;
	status: 'not_started' | 'in_progress' | 'completed';
	progressPct: number;
	mastery: number;
	minutesSpent: number;
	prerequisites: string[];
	prerequisiteTitles: string[];
	available: boolean;
	nextReviewAt: Date | null;
	intervalDays: number;
	easeFactor: number;
	reviewCount: number;
	lastReviewedAt: Date | null;
};

export type PlanItemKind = 'learn' | 'practice' | 'assess' | 'revise' | 'project' | 'carry_over';

export type PlanItemDraft = {
	position: number;
	kind: PlanItemKind;
	title: string;
	detail: string;
	minutes: number;
	ref: { topicId?: string; projectId?: string; assessmentId?: string; exerciseIndex?: number };
};

export type PlanDraft = {
	focus: string;
	budgetMinutes: number;
	plannedMinutes: number;
	rationale: string[];
	items: PlanItemDraft[];
};
