import { addDaysISO, clamp, todayISO } from '$lib/utils';

/**
 * Lightweight SM-2–inspired scheduler. Grades are 0–5 and come from assessment
 * scores, practice completion and check-in confidence — never from the client directly.
 */
export type ReviewState = {
	easeFactor: number;
	intervalDays: number;
	reviewCount: number;
};

export type ReviewOutcome = ReviewState & {
	nextReviewAt: Date;
	lastReviewedAt: Date;
};

const MIN_EASE = 1.3;
const MAX_EASE = 2.8;

export function initialReviewState(): ReviewState {
	return { easeFactor: 2.4, intervalDays: 1, reviewCount: 0 };
}

/** Converts an assessment score (0–100) into an SM-2 grade. */
export function gradeFromScore(score: number): number {
	if (score >= 95) return 5;
	if (score >= 85) return 4;
	if (score >= 72) return 3;
	if (score >= 60) return 2;
	if (score >= 45) return 1;
	return 0;
}

/** Maps a check-in confidence rating (1–5) into a grade, blending with completion. */
export function gradeFromCheckIn(confidence: number, completed: 'yes' | 'partly' | 'no'): number {
	const base = clamp(Math.round(confidence), 1, 5);
	if (completed === 'yes') return clamp(base + 1, 0, 5);
	if (completed === 'partly') return clamp(base, 0, 5);
	return clamp(base - 2, 0, 5);
}

export function schedule(state: ReviewState | null | undefined, grade: number, now: Date = new Date()): ReviewOutcome {
	const current: ReviewState = state ?? initialReviewState();
	const g = clamp(Math.round(grade), 0, 5);

	// Ease factor moves with the grade, floored so a bad day never destroys the schedule.
	const nextEase = clamp(current.easeFactor + (0.1 - (5 - g) * (0.08 + (5 - g) * 0.02)), MIN_EASE, MAX_EASE);

	let intervalDays: number;
	if (g < 3) {
		// Lapse: relearn tomorrow, keeping accumulated ease so recovery is quick.
		intervalDays = 1;
	} else if (current.reviewCount === 0) {
		intervalDays = 1;
	} else if (current.reviewCount === 1) {
		intervalDays = 6;
	} else {
		intervalDays = Math.max(1, Math.round(current.intervalDays * nextEase));
	}

	// A perfect recall can stretch slightly further, but never without bound.
	if (g === 5 && intervalDays > 1) intervalDays = Math.round(intervalDays * 1.15);
	intervalDays = clamp(intervalDays, 1, 240);

	return {
		easeFactor: Number(nextEase.toFixed(3)),
		intervalDays,
		reviewCount: current.reviewCount + 1,
		lastReviewedAt: now,
		nextReviewAt: new Date(`${addDaysISO(todayISO(now), intervalDays)}T06:00:00.000Z`)
	};
}

/** A topic is due when its scheduled review date has arrived. */
export function isDue(nextReviewAt: Date | string | null | undefined, now: Date = new Date()): boolean {
	if (!nextReviewAt) return false;
	const at = nextReviewAt instanceof Date ? nextReviewAt : new Date(nextReviewAt);
	return at.getTime() <= now.getTime();
}

/** Priority used to order the revision queue: overdue + low mastery first. */
export function revisionPriority(
	input: {
		nextReviewAt: Date | string | null;
		mastery: number;
		reviewCount: number;
		difficulty: number;
	},
	now: Date = new Date()
): number {
	const due = input.nextReviewAt ? (now.getTime() - new Date(input.nextReviewAt).getTime()) / 86_400_000 : 0;
	const overdueDays = Math.max(0, due);
	const masteryGap = 100 - clamp(input.mastery, 0, 100);
	const seenPenalty = input.reviewCount === 0 ? 25 : 0;
	const difficultyWeight = clamp(input.difficulty, 1, 5) * 4;
	return Math.round(overdueDays * 12 + masteryGap * 0.8 + seenPenalty + difficultyWeight);
}

/** Retention estimate used for weak-area ranking and the dashboard. */
export function retention(
	input: { mastery: number; reviewCount: number; lastReviewedAt: Date | string | null },
	now: Date = new Date()
): number {
	const base = clamp(input.mastery, 0, 100);
	if (!input.lastReviewedAt) return base;
	const days = Math.max(0, (now.getTime() - new Date(input.lastReviewedAt).getTime()) / 86_400_000);
	// Forgetting curve: ~9% retention lost per week without review at mastery 100.
	const decay = Math.min(0.55, (days / 7) * 0.09);
	return Math.round(clamp(base * (1 - decay), 0, 100));
}
