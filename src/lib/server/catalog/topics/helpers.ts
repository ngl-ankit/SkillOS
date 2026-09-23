import type { CatalogQuestion } from '../types';

/** Compact constructors so topic files stay readable. */
export const mcq = (
	prompt: string,
	options: string[],
	answer: 'a' | 'b' | 'c' | 'd',
	concept: string,
	explanation: string
): CatalogQuestion => ({ type: 'mcq', prompt, options, answer, concept, explanation });

export const tf = (prompt: string, answer: boolean, concept: string, explanation: string): CatalogQuestion => ({
	type: 'true_false',
	prompt,
	answer: String(answer),
	concept,
	explanation
});

export const short = (
	prompt: string,
	answer: string,
	keywords: string[],
	concept: string,
	explanation: string
): CatalogQuestion => ({
	type: 'short',
	prompt,
	answer,
	keywords,
	concept,
	explanation
});

export const code = (
	prompt: string,
	answer: string,
	keywords: string[],
	concept: string,
	explanation: string,
	snippet?: string
): CatalogQuestion => ({ type: 'code', prompt, answer, keywords, concept, explanation, code: snippet });
