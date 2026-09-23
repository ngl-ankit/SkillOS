<script lang="ts">
	
	import { createQuery } from '@tanstack/svelte-query';
	import EmptyState from '$components/EmptyState.svelte';
	import ErrorState from '$components/ErrorState.svelte';
	import Loading from '$components/Loading.svelte';
	import ProgressBar from '$components/ProgressBar.svelte';
import { api } from '$lib/trpc';
	import { cx } from '$lib/utils';

	const tree = createQuery(() => ({ queryKey: ['roadmap'], queryFn: () => api.roadmap.tree.query({}) }));
	const domains = createQuery(() => ({ queryKey: ['domains'], queryFn: () => api.topics.domains.query() }));

	let domain = $state('all');
	let query = $state('');

	const topics = $derived.by(() => {
		const phases = tree.data?.phases ?? [];
		const flat = phases.flatMap((p) => p.topics.map((t) => ({ ...t, phaseTitle: p.title })));
		return flat.filter((t) => {
			if (domain !== 'all' && t.domain !== domain) return false;
			if (query.trim().length >= 2 && !`${t.title} ${t.description}`.toLowerCase().includes(query.trim().toLowerCase())) return false;
			return true;
		});
	});
</script>

<header class="head">
	<h1>Learn</h1>
	<input class="search" type="search" bind:value={query} placeholder="Filter topics…" maxlength="120" />
</header>

{#if domains.data && domains.data.length > 1}
	<div class="chips">
		<button type="button" class:on={domain === 'all'} onclick={() => (domain = 'all')}>All</button>
		{#each domains.data as d (d.domain)}
			<button type="button" class:on={domain === d.domain} onclick={() => (domain = d.domain)}>{d.domain} ({d.total})</button>
		{/each}
	</div>
{/if}

{#if tree.isLoading}
	<Loading />
{:else if tree.error}
	<ErrorState retry={() => tree.refetch()} />
{:else if topics.length === 0}
	<EmptyState title="No topics match" detail="Clear the filter or generate a roadmap first." />
{:else}
	<ul class="list">
		{#each topics as topic (topic.topicId)}
			<li class="surface-card">
				<div class="row">
					<a class="t" href={`/app/learn/${topic.topicId}`}>{topic.title}</a>
					<span class="meta">{topic.phaseTitle} · {topic.status.replace('_', ' ')} · {topic.estimatedMinutes} min</span>
				</div>
				<p class="d">{topic.description}</p>
				<ProgressBar value={topic.progressPct} size="sm" />
			</li>
		{/each}
	</ul>
{/if}

<style>
	.head { display: flex; justify-content: space-between; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 12px; }
	h1 { margin: 0; }
	.search {
		min-height: 42px; padding: 0 14px; border-radius: var(--radius-sm);
		border: 1px solid var(--border-strong); background: var(--surface-3); color: var(--text); font-size: 14px; width: min(320px, 100%);
	}
	.chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
	.chips button {
		min-height: 34px; padding: 0 14px; border-radius: 99px; border: 1px solid var(--border-strong);
		background: var(--surface-3); color: var(--text-secondary); font-size: 12.5px;
	}
	.chips button.on { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
	.list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; max-width: 820px; }
	.list li { padding: 16px 18px; display: grid; gap: 8px; }
	.row { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
	.t { color: var(--text); text-decoration: none; font-weight: 540; font-size: 15px; }
	.t:hover { color: var(--accent); }
	.meta { color: var(--text-muted); font-size: 12px; }
	.d { margin: 0; font-size: 13px; color: var(--text-muted); }
</style>
