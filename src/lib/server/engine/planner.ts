import { clamp } from '$lib/utils';
import type { PlanDraft, PlanItemDraft, PlanItemKind, TopicSnapshot } from './types';

export type PlannerInput = {
	/** Minutes the learner actually has today, already scaled by their adaptation factor. */
	budgetMinutes: number;
	goalTitle: string;
	topics: TopicSnapshot[];
	/** Topics whose scheduled review is due, highest priority first. */
	dueReviews: TopicSnapshot[];
	/** Low-mastery topics that are not necessarily due yet. */
	weakTopics: TopicSnapshot[];
	/** Items rolled over from the previous day's unfinished plan. */
	carryOver: { title: string; detail: string; minutes: number; kind: PlanItemKind; topicId?: string }[];
	/** The project currently in progress, if any. */
	activeProject: { id: string; title: string; nextMilestone: string | null; minutesPerDay: number } | null;
	learningStyle: 'reading' | 'video' | 'hands_on' | 'mixed';
	level: 'beginner' | 'intermediate' | 'advanced';
	/** Recent check-in signals. */
	adaptation: { intensity: number; reviewBias: number };
	hasAssessment: boolean;
};

const KIND_LABEL: Record<PlanItemKind, string> = {
	learn: 'Learn',
	practice: 'Practice',
	assess: 'Assessment',
	revise: 'Revise',
	project: 'Project',
	carry_over: 'Finish'
};

/** Block allocation by realistic session length — never a plan you cannot finish. */
function allocation(budget: number): { kind: PlanItemKind; share: number }[] {
	if (budget <= 20) return [{ kind: 'learn', share: 0.55 }, { kind: 'revise', share: 0.45 }];
	if (budget <= 45) return [{ kind: 'learn', share: 0.4 }, { kind: 'practice', share: 0.4 }, { kind: 'revise', share: 0.2 }];
	if (budget <= 75) return [{ kind: 'learn', share: 0.36 }, { kind: 'practice', share: 0.34 }, { kind: 'assess', share: 0.14 }, { kind: 'revise', share: 0.16 }];
	if (budget <= 120)
		return [
			{ kind: 'learn', share: 0.3 },
			{ kind: 'practice', share: 0.3 },
			{ kind: 'project', share: 0.2 },
			{ kind: 'revise', share: 0.2 }
		];
	return [
		{ kind: 'learn', share: 0.26 },
		{ kind: 'practice', share: 0.28 },
		{ kind: 'assess', share: 0.12 },
		{ kind: 'project', share: 0.2 },
		{ kind: 'revise', share: 0.14 }
	];
}

/** The next topic the learner should work on: first available, unfinished, in roadmap order. */
export function nextTopic(topics: TopicSnapshot[]): TopicSnapshot | null {
	return topics.find((t) => t.status === 'in_progress') ?? topics.find((t) => t.available && t.status === 'not_started') ?? null;
}

function styleHint(style: PlannerInput['learningStyle']): string {
	switch (style) {
		case 'video':
			return 'Start with the video walkthrough, then re-implement it yourself.';
		case 'reading':
			return 'Read the reference material first, then summarise it in your own notes.';
		case 'hands_on':
			return 'Skim the reference, then build something small immediately.';
		default:
			return 'Skim the reference, then practise until it sticks.';
	}
}

/**
 * Composes a daily plan from real learner state. Priorities, in order:
 * carry-over → spaced revision → the next roadmap topic → assessment → project work.
 */
export function composePlan(input: PlannerInput): PlanDraft {
	const budget = clamp(Math.round(input.budgetMinutes), 10, 600);
	const rationale: string[] = [];
	const items: PlanItemDraft[] = [];
	let remaining = budget;

	const push = (kind: PlanItemKind, title: string, detail: string, minutes: number, ref: PlanItemDraft['ref'] = {}) => {
		const m = clamp(Math.round(minutes), 5, Math.max(5, remaining));
		if (remaining < 5) return;
		items.push({ position: items.length + 1, kind, title, detail, minutes: m, ref });
		remaining -= m;
	};

	// 1 — Carry-over is honoured first so missed work cannot silently disappear.
	const carryBudget = Math.min(remaining * 0.35, input.carryOver.reduce((s, c) => s + c.minutes, 0));
	if (carryBudget >= 5) {
		let used = 0;
		for (const c of input.carryOver.slice(0, 3)) {
			if (remaining < 5 || used >= carryBudget) break;
			const share = clamp(Math.round((c.minutes / input.carryOver.reduce((s, x) => s + x.minutes, 0)) * carryBudget), 5, 40);
			push('carry_over', c.title, c.detail || 'Left over from your last session.', share, c.topicId ? { topicId: c.topicId } : {});
			used += share;
		}
		if (items.length > 0) rationale.push('Carried over unfinished work from your previous plan.');
	}

	const blocks = allocation(budget);
	const reviseShare = blocks.find((b) => b.kind === 'revise')?.share ?? 0.15;
	const assessShare = blocks.find((b) => b.kind === 'assess')?.share ?? 0;

	// 2 — Spaced revision. A negative reviewBias means the learner found it easy, so we shorten it.
	const bias = clamp(input.adaptation.reviewBias, -25, 40) / 100;
	const reviseMinutes = Math.max(0, remaining * (reviseShare + bias));
	const revisionCandidates = input.dueReviews.length > 0 ? input.dueReviews : input.weakTopics;
	if (revisionCandidates.length > 0 && reviseMinutes >= 5 && remaining >= 15) {
		const picks = revisionCandidates.slice(0, revisionCandidates.length >= 3 ? 2 : 1);
		const each = Math.round(reviseMinutes / picks.length);
		for (const t of picks) {
			const why = t.nextReviewAt && new Date(t.nextReviewAt).getTime() <= Date.now() ? 'Due for review' : `Mastery at ${t.mastery}%`;
			push('revise', `Revise: ${t.title}`, `${why}. Re-do one practice item, then explain the idea out loud in one sentence.`, each, {
				topicId: t.topicId
			});
		}
		rationale.push(
			input.dueReviews.length > 0
				? 'Included topics whose spaced-review date has arrived.'
				: 'Included your lowest-mastery topics to stop them decaying.'
		);
	}

	// 3 — The next roadmap topic: the core of the day.
	const learning = blocks.filter((b) => b.kind === 'learn' || b.kind === 'practice');
	const focus = nextTopic(input.topics);
	if (focus && remaining >= 10) {
		const learnShare = learning.find((b) => b.kind === 'learn')?.share ?? 0.35;
		const practiceShare = learning.find((b) => b.kind === 'practice')?.share ?? 0.35;
		const conceptMinutes = Math.round(budget * learnShare);
		const practiceMinutes = Math.round(budget * practiceShare);

		const isContinuation = focus.status === 'in_progress' && focus.progressPct > 0;
		push(
			'learn',
			isContinuation ? `Continue: ${focus.title}` : `Learn: ${focus.title}`,
			focus.concepts.length > 0
				? `Cover ${focus.concepts.slice(0, 3).join(', ')}. ${styleHint(input.learningStyle)}`
				: styleHint(input.learningStyle),
			conceptMinutes,
			{ topicId: focus.topicId }
		);
		if (practiceMinutes >= 5 && remaining >= 5) {
			push(
				'practice',
				`Practice: ${focus.title}`,
				focus.difficulty >= 4
					? 'Attempt the hardest exercise without looking at the solution first.'
					: 'Work through the exercises and check each answer before moving on.',
				practiceMinutes,
				{ topicId: focus.topicId, exerciseIndex: 0 }
			);
		}
		rationale.push(
			isContinuation
				? `Continues ${focus.title}, which is ${focus.progressPct}% complete.`
				: `Next available topic in "${input.goalTitle}".`
		);
	} else if (!focus) {
		rationale.push('Every available topic is complete — the plan focuses on revision and your project.');
	}

	// 4 — Assessment, but only once there is something worth testing.
	if (assessShare > 0 && remaining >= 15 && focus && (focus.progressPct >= 50 || focus.status === 'in_progress')) {
		push(
			'assess',
			`Check: ${focus.title}`,
			'Answer the topic assessment to confirm understanding before moving on.',
			Math.round(budget * assessShare),
			{ topicId: focus.topicId }
		);
		rationale.push('Adds a knowledge check so progress is measured, not assumed.');
	}

	// 5 — Project work keeps the roadmap anchored to something real.
	if (input.activeProject && remaining >= 15) {
		const projectShare = blocks.find((b) => b.kind === 'project')?.share ?? 0.18;
		push(
			'project',
			`Project: ${input.activeProject.title}`,
			input.activeProject.nextMilestone
				? `Next milestone — ${input.activeProject.nextMilestone}.`
				: 'Make one concrete step you can show.',
			Math.round(budget * projectShare),
			{ projectId: input.activeProject.id }
		);
		rationale.push('Keeps your project advancing alongside the theory.');
	}

	// 6 — Fill any slack with a short consolidation block rather than an impossible plan.
	if (remaining >= 15) {
		const filler = input.weakTopics[0] ?? input.topics.find((t) => t.status === 'completed');
		if (filler) {
			push(
				'revise',
				`Consolidate: ${filler.title}`,
				'Rewrite your notes from memory, then diff them against the resource.',
				remaining,
				{ topicId: filler.topicId }
			);
			rationale.push('Uses the remaining time to consolidate rather than start something new.');
		}
	}

	const plannedMinutes = items.reduce((sum, i) => sum + i.minutes, 0);
	const focusTitle = focus ? focus.title : (input.activeProject?.title ?? 'Revision and consolidation');

	if (rationale.length === 0) rationale.push('A balanced first session to get you moving.');

	return {
		focus: focusTitle,
		budgetMinutes: budget,
		plannedMinutes,
		rationale: rationale.slice(0, 4),
		items: items.map((item, index) => ({ ...item, position: index + 1 }))
	};
}

export { KIND_LABEL };
