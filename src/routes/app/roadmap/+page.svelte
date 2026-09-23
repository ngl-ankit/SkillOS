<script lang="ts">
	
	import { createQuery } from '@tanstack/svelte-query';
	import EmptyState from '$components/EmptyState.svelte';
	import ErrorState from '$components/ErrorState.svelte';
	import Loading from '$components/Loading.svelte';
	import ProgressBar from '$components/ProgressBar.svelte';
import { api } from '$lib/trpc';
	import { cx } from '$lib/utils';

	const tree = createQuery(() => ({ queryKey: ['roadmap'], queryFn: () => api.roadmap.tree.query({}) }));

	function stateOf(topic: { status: string; available: boolean; progressPct: number }): 'locked' | 'available' | 'current' | 'in_progress' | 'completed' {
		if (topic.status === 'completed') return 'completed';
		if (topic.status === 'in_progress') return 'in_progress';
		if (!topic.available) return 'locked';
		return topic.progressPct > 0 ? 'current' : 'available';
	}

	async function reachMilestone(phaseId: string) {
		await api.roadmap.refreshMilestones.mutate({});
		await tree.refetch();
		void phaseId;
	}
</script>

<header class="head">
	<h1>Roadmap</h1>
	{#if tree.data?.roadmap}<span class="meta">v{tree.data.roadmap.version} · for {tree.data.goalTitle}</span>{/if}
</header>

{#if tree.isLoading}
	<Loading detail="Loading roadmap…" />
{:else if tree.error}
	<ErrorState retry={() => tree.refetch()} />
{:else if !tree.data}
	<EmptyState title="No roadmap yet" detail="Finish onboarding or create a goal to generate one." actionLabel="Go to goals" onAction={() => location.assign('/app/goals')} />
{:else}
	{#if tree.data.progress}
		<section class="surface-card summary">
			<div class="nums">
				<span class="big">{tree.data.progress.percent}%</span>
				<span class="meta">{tree.data.progress.completed} done · {tree.data.progress.inProgress} active · {tree.data.progress.available} available · {tree.data.progress.locked} locked</span>
			</div>
			<ProgressBar value={tree.data.progress.percent} tone="success" />
		</section>
	{/if}

	{#each tree.data.phases as phase (phase.id)}
		<section class="phase">
			<header>
				<h2>{phase.title}</h2>
				<span class="badge" class:reached={phase.milestoneReachedAt}>{phase.completed}/{phase.total} · milestone: {phase.milestoneTitle}</span>
			</header>
			<p class="desc">{phase.description}</p>
			<ul class="topics">
				{#each phase.topics as topic (topic.topicId)}
					{@const nodeState = stateOf(topic)}
					<li class="surface-card">
						<span class="dot {nodeState}" aria-hidden="true"></span>
						<div class="body">
							<a class="t" href={`/app/learn/${topic.topicId}`}>{topic.title}</a>
							<p class="meta">
								{topic.domain} · {topic.difficulty}/5 · {topic.estimatedMinutes} min · mastery {topic.mastery}%
								{#if topic.isReinforcement}· reinforcement{/if}
							</p>
						</div>
						<span class="state {nodeState}">{nodeState.replace('_', ' ')}</span>
					</li>
				{/each}
			</ul>
			{#if phase.percent === 100 && !phase.milestoneReachedAt}
				<button type="button" onclick={() => reachMilestone(phase.id)}>Mark milestone reached</button>
			{/if}
		</section>
	{/each}

	{#if tree.data.projects.length > 0}
		<section class="surface-card projects">
			<h3>Projects in this roadmap</h3>
			<ul class="mini">
				{#each tree.data.projects as project (project.id)}
					<li><a href={`/app/projects/${project.id}`}>{project.title}</a><span class="meta">{project.status.replace('_', ' ')} · {project.done}/{project.total} milestones</span></li>
				{/each}
			</ul>
		</section>
	{/if}
{/if}

<style>
	.head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
	h1 { margin: 0; }
	.meta { color: var(--text-muted); font-size: 12.5px; }
	.summary { padding: 20px; margin-bottom: 20px; display: grid; gap: 10px; }
	.nums { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
	.big { font-size: 32px; font-weight: 580; letter-spacing: -0.02em; }
	.phase { margin-bottom: 26px; }
	.phase header { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; }
	.phase h2 { margin: 0 0 2px; font-size: 18px; }
	.badge { font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); }
	.badge.reached { color: var(--success); }
	.desc { margin: 0 0 12px; color: var(--text-muted); font-size: 13px; }
	.topics { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
	.topics li { display: flex; align-items: center; gap: 12px; padding: 12px 14px; }
	.dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
	.dot.locked { background: var(--node-locked); }
	.dot.available { background: var(--node-available); }
	.dot.current { background: var(--node-current); box-shadow: 0 0 0 3px var(--accent-soft); }
	.dot.in_progress { background: var(--node-active); }
	.dot.completed { background: var(--node-complete); }
	.body { flex: 1; min-width: 0; }
	.t { color: var(--text); text-decoration: none; font-size: 14px; font-weight: 520; }
	.t:hover { color: var(--accent); }
	.state { font-family: var(--font-mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.07em; flex: none; }
	.state.locked { color: var(--text-faint); }
	.state.available { color: var(--text-muted); }
	.state.current { color: var(--node-current); }
	.state.in_progress { color: var(--node-active); }
	.state.completed { color: var(--node-complete); }
	.phase > button { margin-top: 10px; min-height: 38px; padding: 0 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-strong); background: var(--surface-3); color: var(--text); font-size: 13px; }
	.projects { padding: 18px 20px; }
	.projects h3 { margin: 0 0 10px; font-size: 14px; color: var(--text-secondary); }
	.mini { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
	.mini li { display: flex; justify-content: space-between; gap: 10px; font-size: 13.5px; flex-wrap: wrap; }
	.mini a { color: var(--text); text-decoration: none; }
	.mini a:hover { color: var(--accent); }
</style>
