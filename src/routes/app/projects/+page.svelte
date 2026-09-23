<script lang="ts">
	
	import { createQuery } from '@tanstack/svelte-query';
	import EmptyState from '$components/EmptyState.svelte';
	import ErrorState from '$components/ErrorState.svelte';
	import Loading from '$components/Loading.svelte';
	import ProgressBar from '$components/ProgressBar.svelte';
import { api } from '$lib/trpc';
	import { humanHours } from '$lib/utils';

	const projects = createQuery(() => ({ queryKey: ['projects'], queryFn: () => api.projects.list.query() }));
</script>

<h1>Projects</h1>

{#if projects.isLoading}
	<Loading />
{:else if projects.error}
	<ErrorState retry={() => projects.refetch()} />
{:else if !projects.data || projects.data.length === 0}
	<EmptyState title="No projects yet" detail="Projects appear here once a roadmap generates them." />
{:else}
	<ul class="grid">
		{#each projects.data as p (p.id)}
			<li class="surface-card">
				<div class="row">
					<a href={`/app/projects/${p.id}`}>{p.title}</a>
					<span class="status {p.status}">{p.status.replace('_', ' ')}</span>
				</div>
				<p class="d">{p.goal}</p>
				<ProgressBar value={p.percent} size="sm" tone={p.percent === 100 ? 'success' : 'accent'} />
				<p class="meta">{p.done}/{p.total} milestones · ~{humanHours(p.estimatedHours * 60)} · next: {p.nextMilestone ?? '—'}</p>
			</li>
		{/each}
	</ul>
{/if}

<style>
	h1 { margin: 0 0 16px; }
	.grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
	.grid li { padding: 18px 20px; display: grid; gap: 8px; align-content: start; }
	.row { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; }
	.row a { color: var(--text); font-weight: 540; font-size: 15px; text-decoration: none; }
	.row a:hover { color: var(--accent); }
	.status { font-family: var(--font-mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); }
	.status.in_progress { color: var(--node-active); }
	.status.completed { color: var(--node-complete); }
	.d { margin: 0; font-size: 13px; color: var(--text-secondary); }
	.meta { margin: 0; font-size: 12px; color: var(--text-muted); }
</style>
