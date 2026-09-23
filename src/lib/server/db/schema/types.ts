import { customType } from 'drizzle-orm/pg-core';

/** Postgres full-text search vector (generated column). */
export const tsvector = customType<{ data: string }>({
	dataType() {
		return 'tsvector';
	}
});

export type PracticeExercise = { title: string; prompt: string; hint?: string };
export type ProjectMilestone = { title: string; detail: string };
export type QuestionOption = { key: string; label: string };
export type QuestionResult = { questionId: string; correct: boolean; score: number; feedback: string; concept: string };
export type AttemptSummary = {
	understood: string[];
	weak: string[];
	revise: { topicId: string; title: string }[];
	nextStep: string;
	aiFeedback?: string;
};
export type PlanItemRef = {
	topicId?: string;
	resourceId?: string;
	assessmentId?: string;
	projectId?: string;
	exerciseIndex?: number;
};
