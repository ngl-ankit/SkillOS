import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$server/db';
import { projects, roadmapPhases, roadmaps, topicPrerequisites, topics } from '$server/db/schema';
import { AppError } from '$server/errors';
import { getPrimaryGoal, getRoadmapBundle } from '$server/services/access';
import { roadmapProgress } from '$server/services/progress';
import { ctx } from '../init';

export type UniverseNodeState = 'locked' | 'available' | 'current' | 'in_progress' | 'completed';

export type UniverseNode = {
	id: string;
	label: string;
	kind: 'goal' | 'phase' | 'topic' | 'project' | 'milestone';
	state: UniverseNodeState;
	domain: string;
	difficulty: number;
	progressPct: number;
	mastery: number;
	estimatedMinutes: number;
	phaseTitle: string;
	position: number;
	x: number;
	y: number;
	z: number;
	parentId: string | null;
};

export type UniverseLink = { from: string; to: string; kind: 'phase' | 'prerequisite' | 'project' };

export type UniverseGraph = {
	goalId: string;
	goalTitle: string;
	nodes: UniverseNode[];
	links: UniverseLink[];
	phases: { id: string; title: string; position: number }[];
	summary: { total: number; completed: number; percent: number; currentTopicId: string | null };
};

/**
 * Deterministic 3D layout. The goal sits at the origin, phases fan out along a
 * shallow arc, and topics orbit their phase in prerequisite order. Positions are
 * computed on the server so the 2D fallback and the 3D scene always agree.
 */
function layout(
	phases: {
		id: string;
		title: string;
		position: number;
		topics: {
			topicId: string;
			title: string;
			position: number;
			phaseTitle: string;
			difficulty: number;
			status: string;
			progressPct: number;
			mastery: number;
			estimatedMinutes: number;
			domain: string;
			available: boolean;
			prerequisites: string[];
		}[];
	}[]
) {
	const nodes: Omit<UniverseNode, 'state' | 'kind' | 'parentId' | 'phaseTitle'>[] = [];
	const links: { from: string; to: string; kind: UniverseLink['kind'] }[] = [];
	const phaseCount = Math.max(1, phases.length);
	const radiusBase = 15;

	phases.forEach((phase, phaseIndex) => {
		// Phases are laid out on a spiral so the scene reads as depth, not a flat ring.
		const angle = (phaseIndex / phaseCount) * Math.PI * 2;
		const phaseRadius = radiusBase + phaseIndex * 4.5;
		const px = Math.cos(angle) * phaseRadius;
		const pz = Math.sin(angle) * phaseRadius;
		const py = phaseIndex * 2.2 - (phaseCount - 1) * 1.1;

		const nodeId = `phase:${phase.id}`;
		nodes.push({
			id: nodeId,
			label: phase.title,
			domain: 'phase',
			difficulty: 1,
			progressPct: 0,
			mastery: 0,
			estimatedMinutes: 0,
			position: phaseIndex,
			x: px,
			y: py,
			z: pz
		});

		const topicCount = Math.max(1, phase.topics.length);
		phase.topics.forEach((topic, topicIndex) => {
			const spread = Math.PI * 1.35;
			const tAngle = angle + (topicIndex / topicCount - 0.5) * spread;
			const orbit = 3.6 + (topicIndex % 3) * 1.15;
			nodes.push({
				id: topic.topicId,
				label: topic.title,
				domain: topic.domain,
				difficulty: topic.difficulty,
				progressPct: topic.progressPct,
				mastery: topic.mastery,
				estimatedMinutes: topic.estimatedMinutes,
				position: topic.position,
				x: px + Math.cos(tAngle) * orbit,
				y: py + (topicIndex % 2 === 0 ? 1 : -1) * (1.1 + topicIndex * 0.28),
				z: pz + Math.sin(tAngle) * orbit
			});
			links.push({ from: nodeId, to: topic.topicId, kind: 'phase' });
		});
	});

	return { nodes, links, phaseCount };
}

export const universeRouter = ctx.router({
	/** Full graph for the 3D skill universe and its 2D fallback. */
	graph: ctx.protectedProcedure
		.input(z.object({ goalId: z.string().uuid().nullable().default(null) }))
		.query(async ({ ctx: c, input }): Promise<UniverseGraph | null> => {
			const goal = input.goalId ? { id: input.goalId, title: '' } : await getPrimaryGoal(c.user.id);
			if (!goal) return null;
			const bundle = await getRoadmapBundle(c.user.id, goal.id);
			if (!bundle) return null;
			const progress = await roadmapProgress(c.user.id, goal.id);

			const phaseRows = await db
				.select()
				.from(roadmapPhases)
				.where(eq(roadmapPhases.roadmapId, bundle.roadmap.id))
				.orderBy(asc(roadmapPhases.position));

			const topicRows = await db
				.select()
				.from(topics)
				.where(eq(topics.roadmapId, bundle.roadmap.id))
				.orderBy(asc(topics.position));
			const edges =
				topicRows.length > 0
					? await db
							.select()
							.from(topicPrerequisites)
							.where(
								inArray(
									topicPrerequisites.topicId,
									topicRows.map((t) => t.id)
								)
							)
					: [];
			const projectRows = await db
				.select()
				.from(projects)
				.where(and(eq(projects.userId, c.user.id), eq(projects.roadmapId, bundle.roadmap.id)));

			const snapshotById = new Map(bundle.topics.map((t) => [t.topicId, t]));
			const currentId = progress?.currentTopicId ?? null;

			const phasesForLayout = phaseRows.map((phase) => ({
				id: phase.id,
				title: phase.title,
				position: phase.position,
				topics: topicRows
					.filter((t) => t.phaseId === phase.id)
					.map((t) => {
						const snap = snapshotById.get(t.id);
						return {
							topicId: t.id,
							title: t.title,
							position: t.position,
							phaseTitle: phase.title,
							difficulty: t.difficulty,
							status: snap?.status ?? 'not_started',
							progressPct: snap?.progressPct ?? 0,
							mastery: snap?.mastery ?? 0,
							estimatedMinutes: t.estimatedMinutes,
							domain: t.domain,
							available: snap?.available ?? false,
							prerequisites: edges.filter((e) => e.topicId === t.id).map((e) => e.prerequisiteId)
						};
					})
			}));

			const { nodes, links } = layout(phasesForLayout);
			const phaseTitleById = new Map(phaseRows.map((p) => [p.id, p.title]));

			const toState = (id: string, available: boolean, status: string, progressPct: number): UniverseNodeState => {
				if (id === currentId) return 'current';
				if (status === 'completed') return 'completed';
				if (status === 'in_progress' || progressPct > 0) return 'in_progress';
				return available ? 'available' : 'locked';
			};

			const enriched: UniverseNode[] = nodes.map((node) => {
				if (node.id.startsWith('phase:')) {
					const phaseId = node.id.slice(6);
					const inPhase = topicRows.filter((t) => t.phaseId === phaseId);
					const done = inPhase.filter((t) => snapshotById.get(t.id)?.status === 'completed').length;
					return {
						...node,
						kind: 'phase',
						parentId: goal.id,
						phaseTitle: phaseTitleById.get(phaseId) ?? 'Phase',
						state: done === inPhase.length && inPhase.length > 0 ? 'completed' : done > 0 ? 'in_progress' : 'available'
					};
				}
				const snap = snapshotById.get(node.id);
				const topic = topicRows.find((t) => t.id === node.id);
				return {
					...node,
					kind: 'topic',
					parentId: topic ? `phase:${topic.phaseId}` : null,
					phaseTitle: snap?.phaseTitle ?? 'Phase',
					state: toState(node.id, snap?.available ?? false, snap?.status ?? 'not_started', snap?.progressPct ?? 0)
				};
			});

			// The goal anchors the scene at the origin.
			enriched.unshift({
				id: goal.id,
				label: bundle.roadmap.title,
				kind: 'goal',
				state: 'in_progress',
				domain: 'goal',
				difficulty: 1,
				progressPct: progress?.percent ?? 0,
				mastery: 0,
				estimatedMinutes: progress?.estimatedMinutesRemaining ?? 0,
				phaseTitle: 'Goal',
				position: 0,
				x: 0,
				y: 0,
				z: 0,
				parentId: null
			});

			const graphLinks: UniverseLink[] = links.map((l) => ({ ...l }));
			for (const phase of phaseRows) graphLinks.push({ from: goal.id, to: `phase:${phase.id}`, kind: 'phase' });
			for (const edge of edges) graphLinks.push({ from: edge.prerequisiteId, to: edge.topicId, kind: 'prerequisite' });

			// Projects branch from the phase they reinforce.
			for (const project of projectRows) {
				const anchor = enriched.find((n) => n.id === project.topicId);
				const phaseNode = project.phaseId ? `phase:${project.phaseId}` : null;
				const source = phaseNode && enriched.some((n) => n.id === phaseNode) ? phaseNode : (anchor?.parentId ?? goal.id);
				enriched.push({
					id: project.id,
					label: project.title,
					kind: 'project',
					state: 'available',
					domain: 'project',
					difficulty: project.difficulty,
					progressPct: 0,
					mastery: 0,
					estimatedMinutes: project.estimatedHours * 60,
					phaseTitle: project.phaseId ? (phaseTitleById.get(project.phaseId) ?? 'Project') : 'Project',
					position: 0,
					x: (anchor?.x ?? 0) * 1.32 + 2.4,
					y: (anchor?.y ?? 0) + 4.2,
					z: (anchor?.z ?? 0) * 1.32 - 2.4,
					parentId: source
				});
				graphLinks.push({ from: source, to: project.id, kind: 'project' });
			}

			return {
				goalId: goal.id,
				goalTitle: bundle.roadmap.title,
				nodes: enriched,
				links: graphLinks,
				phases: phaseRows.map((p) => ({ id: p.id, title: p.title, position: p.position })),
				summary: {
					total: bundle.topics.length,
					completed: progress?.completed ?? 0,
					percent: progress?.percent ?? 0,
					currentTopicId: currentId
				}
			};
		}),

	/** Detail panel payload for a selected node. */
	node: ctx.protectedProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ ctx: c, input }) => {
		const bundle = await getRoadmapBundle(c.user.id);
		if (!bundle) throw new AppError('PRECONDITION_FAILED', 'No roadmap yet.');
		const snap = bundle.topics.find((t) => t.topicId === input.id);
		if (snap) {
			const topicRow = await db.select().from(topics).where(eq(topics.id, snap.topicId)).limit(1);
			return {
				kind: 'topic' as const,
				topicId: snap.topicId,
				title: snap.title,
				description: topicRow[0]?.description ?? '',
				domain: snap.domain,
				difficulty: snap.difficulty,
				estimatedMinutes: snap.estimatedMinutes,
				progressPct: snap.progressPct,
				mastery: snap.mastery,
				status: snap.status,
				available: snap.available,
				status_phase: snap.phaseTitle,
				phaseTitle: snap.phaseTitle,
				concepts: topicRow[0]?.concepts ?? [],
				prerequisites: snap.prerequisiteTitles,
				minutesSpent: snap.minutesSpent,
				nextReviewAt: snap.nextReviewAt,
				nextAction:
					snap.status === 'completed'
						? 'Revisit or revise'
						: snap.available
							? snap.progressPct > 0
								? 'Continue learning'
								: 'Start this topic'
							: 'Locked until prerequisites are complete'
			};
		}
		const project = bundle.projectList.find((p) => p.id === input.id);
		if (project) {
			const state = bundle.projectState.get(project.id);
			const done = state?.completedMilestones.length ?? 0;
			return {
				kind: 'project' as const,
				topicId: project.id,
				title: project.title,
				description: project.goal,
				domain: 'project',
				difficulty: project.difficulty,
				estimatedMinutes: project.estimatedHours * 60,
				progressPct: project.milestones.length > 0 ? Math.round((done / project.milestones.length) * 100) : 0,
				mastery: 0,
				status: state?.status ?? 'not_started',
				available: true,
				status_phase: 'Project',
				phaseTitle: 'Project',
				concepts: project.concepts,
				prerequisites: [],
				minutesSpent: 0,
				nextReviewAt: null,
				nextAction: project.milestones[done]?.title ?? 'Review the requirements'
			};
		}
		const phase = bundle.phases.find((p) => `phase:${p.id}` === input.id);
		if (phase) {
			const inPhase = bundle.topics.filter((t) => t.phaseTitle === phase.title);
			const done = inPhase.filter((t) => t.status === 'completed').length;
			return {
				kind: 'phase' as const,
				topicId: phase.id,
				title: phase.title,
				description: phase.description,
				domain: 'phase',
				difficulty: 1,
				estimatedMinutes: inPhase.reduce((sum, t) => sum + t.estimatedMinutes, 0),
				progressPct: inPhase.length > 0 ? Math.round((done / inPhase.length) * 100) : 0,
				mastery: 0,
				status: done === inPhase.length && inPhase.length > 0 ? 'completed' : 'in_progress',
				available: true,
				status_phase: `${done}/${inPhase.length} topics`,
				phaseTitle: phase.milestoneTitle,
				concepts: inPhase.map((t) => t.title),
				prerequisites: [],
				minutesSpent: 0,
				nextReviewAt: null,
				nextAction: phase.milestoneDetail
			};
		}
		const roadmap = (await db.select().from(roadmaps).where(eq(roadmaps.id, bundle.roadmap.id)).limit(1))[0];
		return {
			kind: 'goal' as const,
			topicId: bundle.roadmap.goalId,
			title: roadmap?.title ?? bundle.roadmap.title,
			description: roadmap?.summary ?? '',
			domain: 'goal',
			difficulty: 1,
			estimatedMinutes: bundle.topics.reduce((sum, t) => sum + t.estimatedMinutes, 0),
			progressPct:
				bundle.topics.length > 0
					? Math.round((bundle.topics.filter((t) => t.status === 'completed').length / bundle.topics.length) * 100)
					: 0,
			mastery: 0,
			status: roadmap?.status ?? 'ready',
			available: true,
			status_phase: 'Overall',
			phaseTitle: 'Goal',
			concepts: bundle.phases.map((p) => p.title),
			prerequisites: [],
			minutesSpent: bundle.topics.reduce((sum, t) => sum + t.minutesSpent, 0),
			nextReviewAt: null,
			nextAction: 'Pick up your current topic'
		};
	})
});

void sql;
