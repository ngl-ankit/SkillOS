import type { CatalogQuestion } from '../catalog/types';

export type GradedQuestion = {
	questionId: string;
	position: number;
	type: CatalogQuestion['type'];
	prompt: string;
	concept: string;
	correct: boolean;
	score: number;
	feedback: string;
	expected: string;
	explanation: string;
	given: string;
};

export type GradedAttempt = {
	score: number;
	passed: boolean;
	results: GradedQuestion[];
	understood: string[];
	weak: string[];
	concepts: Map<string, { correct: number; total: number }>;
};

function normalise(input: string): string {
	return input
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.replace(/[^\w\s.+#*/(){}[\]=<>!&|?:'-]/g, '')
		.trim();
}

/** Free-text questions are graded against the reference answer plus keyword evidence. */
function gradeFreeText(
	question: { answer: string; keywords?: string[] },
	given: string
): { correct: boolean; score: number; feedback: string } {
	const response = normalise(given);
	if (response.length === 0) return { correct: false, score: 0, feedback: 'No answer was given.' };

	const keywords = question.keywords ?? [];
	const hits = keywords.filter((k) => {
		try {
			return new RegExp(k, 'i').test(given);
		} catch {
			return given.toLowerCase().includes(k.toLowerCase());
		}
	});

	const coverage = keywords.length > 0 ? hits.length / keywords.length : 0;
	// A close paraphrase of the reference answer also counts.
	const expected = normalise(question.answer);
	const overlap = (() => {
		const words = new Set(expected.split(' ').filter((w) => w.length > 3));
		if (words.size === 0) return 0;
		let found = 0;
		for (const word of words) if (response.includes(word)) found += 1;
		return found / words.size;
	})();

	const ratio = Math.max(coverage * 0.85 + overlap * 0.15, overlap);
	const correct = ratio >= 0.6;
	const score = Math.round(Math.min(1, ratio) * 100);

	const missing = keywords.filter((k) => !hits.includes(k));
	const feedback = correct
		? missing.length === 0
			? 'Complete and accurate.'
			: `Correct. You did not mention: ${missing.slice(0, 3).join(', ')}.`
		: response.length < 12
			? 'Too brief to judge — write a full sentence in your own words.'
			: missing.length > 0
				? `Missing key ideas: ${missing.slice(0, 3).join(', ')}.`
				: 'The answer does not match the expected reasoning.';

	return { correct, score, feedback };
}

/**
 * Grades a set of answers against catalog questions. Deterministic and
 * offline-safe: no AI call is required for the score itself.
 */
export function gradeAnswers(
	questions: {
		id: string;
		position: number;
		type: CatalogQuestion['type'];
		prompt: string;
		concept: string;
		answer: string;
		keywords: string[] | null;
		explanation: string;
		points: number;
	}[],
	answers: Record<string, string>
): GradedAttempt {
	const results: GradedQuestion[] = [];
	const concepts = new Map<string, { correct: number; total: number }>();
	let earned = 0;
	let possible = 0;

	for (const question of questions) {
		const given = answers[question.id] ?? '';
		possible += question.points;
		let correct: boolean;
		let score: number;
		let feedback: string;

		if (question.type === 'mcq' || question.type === 'true_false') {
			const expected = question.answer.trim().toLowerCase();
			const actual = given.trim().toLowerCase();
			correct = expected === actual;
			score = correct ? 100 : 0;
			feedback = correct ? 'Correct.' : actual.length === 0 ? 'Not answered.' : `Incorrect. The expected answer is shown below.`;
		} else {
			const graded = gradeFreeText({ answer: question.answer, keywords: question.keywords ?? [] }, given);
			correct = graded.correct;
			score = graded.score;
			feedback = graded.feedback;
		}

		earned += (score / 100) * question.points;
		const bucket = concepts.get(question.concept) ?? { correct: 0, total: 0 };
		bucket.total += 1;
		if (correct) bucket.correct += 1;
		concepts.set(question.concept, bucket);

		results.push({
			questionId: question.id,
			position: question.position,
			type: question.type,
			prompt: question.prompt,
			concept: question.concept,
			correct,
			score,
			feedback,
			expected: question.answer,
			explanation: question.explanation,
			given
		});
	}

	const score = possible > 0 ? Math.round((earned / possible) * 100) : 0;
	const understood = [...concepts.entries()].filter(([, v]) => v.correct === v.total).map(([k]) => k);
	const weak = [...concepts.entries()].filter(([, v]) => v.correct < v.total).map(([k]) => k);

	return { score, passed: score >= 70, results, understood, weak, concepts };
}

/** Deterministic practice check used by the learning session, kept simple and explainable. */
export function gradePracticeHint(given: string, keywords: string[]): { ok: boolean; hint: string } {
	const text = given.trim();
	if (text.length < 8) return { ok: false, hint: 'Write a bit more so the attempt can be judged.' };
	const hits = keywords.filter((k) => text.toLowerCase().includes(k.toLowerCase()));
	return hits.length > 0
		? { ok: true, hint: 'That covers the key idea. Compare with the reference answer to check the details.' }
		: { ok: false, hint: 'The main idea is not there yet — revisit the concept list, then try again without looking.' };
}
