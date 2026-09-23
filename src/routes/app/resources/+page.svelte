<script lang="ts">
	
	import { createQuery } from '@tanstack/svelte-query';
	import EmptyState from '$components/EmptyState.svelte';
	import ErrorState from '$components/ErrorState.svelte';
	import Loading from '$components/Loading.svelte';
import { api } from '$lib/trpc';
	import { humanMinutes } from '$lib/utils';

	const resources = createQuery(() => ({ queryKey: ['resources'], queryFn: () => api.resources.list.query({ role: 'all', type: 'all', cost: 'all', difficulty: 'all', query: '', savedOnly: false, limit: 200 }) }));
	const saved = createQuery(() => ({ queryKey: ['saved'], queryFn: () => api.resources.saved.query() }));

	let type = $state('all');
	let cost = $state('all');
	let query = $state('');
	let savedOnly = $state(false);

	const filtered = $derived(
		(resources.data?.items ?? []).filter((r) => {
			if (type !== 'all' && r.type !== type) return false;
			if (cost !== 'all' && r.cost !== cost) return false;
			if (savedOnly && !r.saved) return false;
			const q = query.trim().toLowerCase();
			if (q.length >= 2 && !`${r.title} ${r.provider} ${r.description}`.toLowerCase().includes(q)) return false;
			return true;
		})
	);

	async function toggleSave(slug: string, isSaved: boolean) {
		if (isSaved) await api.resources.unsave.mutate({ slug });
		else await api.resources.save.mutate({ slug, status: 'saved' });
		await Promise.all([resources.refetch(), saved.refetch()]);
	}
</script>

<header class="head">
	<h1>Resources</h1>
	{#if resources.data}<span class="meta">{filtered.length} of {resources.data.facets.total} · {resources.data.facets.saved} saved</span>{/if}
</header>

<div class="filters">
	<input type="search" bind:value={query} placeholder="Search…" maxlength="120" />
	<select bind:value={type}>
		<option value="all">All types</option>
		{#each ['documentation', 'tutorial', 'course', 'video', 'interactive', 'book', 'exercise', 'article'] as t (t)}<option value={t}>{t}</option>{/each}
	</select>
	<select bind:value={cost}>
		<option value="all">Any cost</option>
		<option value="free">Free</option>
		<option value="freemium">Freemium</option>
		<option value="paid">Paid</option>
	</select>
	<label class="toggle"><input type="checkbox" bind:checked={savedOnly} /> Saved only</label>
</div>

{#if resources.isLoading}
	<Loading />
{:else if resources.error}
	<ErrorState retry={() => resources.refetch()} />
{:else if filtered.length === 0}
	<EmptyState title="No resources match" detail="Widen the filters or clear the search." />
{:else}
	<ul class="grid">
		{#each filtered as r (r.slug)}
			<li class="surface-card">
				<div class="row">
					<a href={r.url} target="_blank" rel="noopener noreferrer">{r.title}</a>
					<button type="button" class="save" class:on={r.saved} onclick={() => toggleSave(r.slug, r.saved)}>{r.saved ? '★ Saved' : '☆ Save'}</button>
				</div>
				<p class="meta">{r.provider} · {r.type} · {r.cost} · {r.difficulty}/5 · {humanMinutes(r.minutes)}{r.forTopic ? ` · for ${r.forTopic}` : ''}</p>
				<p class="d">{r.description}</p>
				<p class="why">{r.why}</p>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
	h1 { margin: 0; }
	.meta { color: var(--text-muted); font-size: 12.5px; }
	.filters { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 16px; }
	.filters input, .filters select {
		min-height: 40px; padding: 0 12px; border-radius: var(--radius-sm);
		border: 1px solid var(--border-strong); background: var(--surface-3); color: var(--text); font-size: 13.5px;
	}
	.filters input { width: min(260px, 100%); }
	.toggle { display: inline-flex; gap: 6px; align-items: center; font-size: 13px; color: var(--text-secondary); }
	.toggle input { accent-color: var(--accent); }
	.grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
	.grid li { padding: 16px 18px; display: grid; gap: 6px; align-content: start; }
	.row { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
	.row a { color: var(--text); font-weight: 540; font-size: 14.5px; text-decoration: none; }
	.row a:hover { color: var(--accent); }
	.save { flex: none; min-height: 32px; padding: 0 10px; border-radius: var(--radius-xs); border: 1px solid var(--border-strong); background: transparent; color: var(--text-muted); font-size: 12px; }
	.save.on { color: var(--warning); border-color: var(--warning); }
	.d { margin: 0; font-size: 13px; color: var(--text-secondary); }
	.why { margin: 0; font-size: 12px; color: var(--text-faint); }
</style>
