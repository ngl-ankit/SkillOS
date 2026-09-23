import { describe, expect, it } from 'vitest';
import { gradeAnswers, gradePracticeHint } from '../../src/lib/server/engine/grader';
import { composePlan, nextTopic } from '../../src/lib/server/engine/planner';
import { gradeFromCheckIn, gradeFromScore, isDue, revisionPriority, schedule } from '../../src/lib/server/engine/srs';
import type { TopicSnapshot } from '../../src/lib/server/engine/types';
import { addDaysISO, clamp, daysBetween, humanMinutes, pct, todayISO } from '../../src/lib/utils';

describe('utils', () => {
	it('formats minutes readably', () => {
		expect(humanMinutes(45)).toBe('45 min');
		expect(humanMinutes(60)).toBe('1 hr');
		expect(humanMinutes(95)).toBe('1h 35m');
		expect(humanMinutes(0)).toBe('0 min');
	});

	it('clamps and computes percentages', () => {
		expect(clamp(150, 0, 100)).toBe(100);
		expect(pct(1, 4)).toBe(25);
		expect(pct(1, 0)).toBe(0);
	});

	it('does ISO date arithmetic in UTC', () => {
		expect(addDaysISO('2026-09-23', 1)).toBe('2026-09-24');
		expect(addDaysISO('2026-09-01', -1)).toBe('2026-08-31');
		expect(daysBetween('2026-09-01', '2026-09-23')).toBe(22);
		expect(todayISO(new Date('2026-09-23T12:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe('spaced repetition', () => {
	it('maps scores to grades', () => {
		expect(gradeFromScore(96)).toBe(5);
		expect(gradeFromScore(70)).toBe(2);
		expect(gradeFromScore(10)).toBe(0);
	});

	it('lapses after a bad grade and recovers', () => {
		const first = schedule(null, 3, new Date('2026-09-23T10:00:00Z'));
		expect(first.reviewCount).toBe(1);
		const lapsed = schedule(first, 1, new Date('2026-09-24T10:00:00Z'));
		expect(lapsed.intervalDays).toBe(1);
		const recovered = schedule(lapsed, 5, new Date('2026-09-25T10:00:00Z'));
		expect(recovered.intervalDays).toBeGreaterThanOrEqual(1);
		expect(recovered.easeFactor).toBeGreaterThanOrEqual(1.3);
	});

	it('keeps intervals bounded', () => {
		const state = { easeFactor: 2.8, intervalDays: 200, reviewCount: 10 };
		const next = schedule(state, 4);
		expect(next.intervalDays).toBeLessThanOrEqual(240);
	});

	it('detects due topics and ranks urgency', () => {
		expect(isDue(new Date(Date.now() - 1000))).toBe(true);
		expect(isDue(new Date(Date.now() + 86_400_000))).toBe(false);
		const overdue = revisionPriority({
			nextReviewAt: new Date(Date.now() - 3 * 86_400_000),
			mastery: 20,
			reviewCount: 2,
			difficulty: 4
		});
		const fresh = revisionPriority({
			nextReviewAt: new Date(Date.now() + 3 * 86_400_000),
			mastery: 95,
			reviewCount: 5,
			difficulty: 2
		});
		expect(overdue).toBeGreaterThan(fresh);
	});

	it('blends check-in confidence with completion', () => {
		expect(gradeFromCheckIn(5, 'yes')).toBe(5);
		expect(gradeFromCheckIn(1, 'no')).toBe(0);
	});
});

describe('grader', () => {
	const questions = [
		{
			id: 'q1',
			position: 1,
			type: 'mcq' as const,
			prompt: 'p',
			concept: 'c1',
			answer: 'b',
			keywords: [],
			explanation: 'e',
			points: 1
		},
		{
			id: 'q2',
			position: 2,
			type: 'short' as const,
			prompt: 'p',
			concept: 'c2',
			answer: 'A closure is a function that remembers its outer scope',
			keywords: ['closure', 'scope'],
			explanation: 'e',
			points: 2
		}
	];

	it('grades objective answers exactly', () => {
		const graded = gradeAnswers(questions, { q1: 'B', q2: '' });
		expect(graded.results[0].correct).toBe(true);
		expect(graded.score).toBeGreaterThan(0);
		expect(graded.results[1].correct).toBe(false);
	});

	it('grades free text on keyword evidence', () => {
		const graded = gradeAnswers(questions, { q1: 'a', q2: 'A closure remembers the scope where it was defined.' });
		expect(graded.results[1].score).toBeGreaterThanOrEqual(60);
	});

	it('gives actionable practice hints', () => {
		expect(gradePracticeHint('too short', ['scope']).ok).toBe(false);
		expect(gradePracticeHint('this explains the scope and closure behaviour', ['closure', 'scope']).ok).toBe(true);
	});
});

describe('planner', () => {
	const topic = (over: Partial<TopicSnapshot>): TopicSnapshot => ({
		topicId: 't1',
		title: 'Topic',
		domain: 'web',
		difficulty: 3,
		estimatedMinutes: 45,
		position: 0,
		phaseTitle: 'P1',
		status: 'not_started',
		progressPct: 0,
		mastery: 0,
		minutesSpent: 0,
		prerequisites: [],
		prerequisiteTitles: [],
		available: true,
		nextReviewAt: null,
		intervalDays: 0,
		easeFactor: 2.4,
		reviewCount: 0,
		lastReviewedAt: null,
		...over
	});

	it('picks the first available topic', () => {
		const picked = nextTopic([topic({ topicId: 'a', available: false }), topic({ topicId: 'b', available: true })]);
		expect(picked?.topicId).toBe('b');
		expect(nextTopic([])).toBeNull();
	});

	it('composes a plan inside the daily budget', () => {
		const draft = composePlan({
			goalTitle: 'Learn web',
			learningStyle: 'mixed',
			budgetMinutes: 60,
			topics: [topic({})],
			dueReviews: [],
			weakTopics: [],
			carryOver: [],
			activeProject: null,
			level: 'beginner',
			adaptation: { intensity: 100, reviewBias: 0 },
			hasAssessment: false
		});
		expect(draft.plannedMinutes).toBeLessThanOrEqual(70);
		expect(draft.items.length).toBeGreaterThan(0);
		expect(draft.items.every((item) => item.minutes >= 5)).toBe(true);
	});
});
