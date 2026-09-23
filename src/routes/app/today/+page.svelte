<script lang="ts">
	
	import { createQuery } from '@tanstack/svelte-query';
	import ErrorState from '$components/ErrorState.svelte';
	import Loading from '$components/Loading.svelte';
import { api } from '$lib/trpc';
	import { humanMinutes, todayISO } from '$lib/utils';

	const todayQ = createQuery(() => ({ queryKey: ['today', todayISO()], queryFn: () => api.plan.today.query({}) }));

	let busy = $state(false);
	async function regenerate() {
		busy = true;
		try {
			await api.plan.regenerate.mutate({ useAi: false });
			await todayQ.refetch();
		} finally {
			busy = false;
		}
	}
</script>

<header class="head">
	<h1>Today</h1>
	<button type="button" onclick={regenerate} disabled={busy}>{busy ? 'Rebuilding…' : 'Regenerate plan'}</button>
</header>

{#if todayQ.isLoading}
	<Loading detail="Loading plan…" />
{:else if todayQ.error}
	<ErrorState retry={() => todayQ.refetch()} />
{:else if todayQ.data?.plan}
	<p class="meta">{todayQ.data.plan.focus} · {humanMinutes(todayQ.data.plan.plannedMinutes)} planned</p>
	<ul class="blocks">
		{#each todayQ.data.plan.items as item (item.id)}
			<li class="surface-card">
				<span class="kind">{item.kind}</span>
				<div><p class="t">{item.title}</p>{#if item.detail}<p class="d">{item.detail}</p>{/if}</div>
				<span class="m">{humanMinutes(item.minutes)} · {item.status}</span>
			</li>
		{/each}
	</ul>
{:else}
	<p class="meta">No plan yet — open the dashboard to build one.</p>
{/if}

<style>
	.head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
	h1 { margin: 0; }
	button {
		min-height: 40px; padding: 0 16px; border-radius: var(--radius-sm);
		border: 1px solid var(--border-strong); background: var(--surface-3); color: var(--text); font-size: 13.5px;
	}
	.meta { color: var(--text-muted); font-size: 13px; }
	.blocks { list-style: none; margin: 16px 0 0; padding: 0; display: grid; gap: 10px; }
	.blocks li { display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: start; padding: 14px 16px; }
	.kind { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent); background: var(--accent-soft); padding: 3px 6px; border-radius: 4px; }
	.t { margin: 0; font-size: 14px; font-weight: 520; }
	.d { margin: 2px 0 0; font-size: 12.5px; color: var(--text-muted); }
	.m { font-family: var(--font-mono); font-size: 12px; color: var(--text-faint); }
</style>
