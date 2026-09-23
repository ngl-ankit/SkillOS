<script lang="ts">
	
	import { createQuery } from '@tanstack/svelte-query';
	import EmptyState from '$components/EmptyState.svelte';
	import ErrorState from '$components/ErrorState.svelte';
	import Loading from '$components/Loading.svelte';
import { api } from '$lib/trpc';
	import { cx, humanMinutes, todayISO } from '$lib/utils';

	const day = todayISO();
	const queue = createQuery(() => ({ queryKey: ['revision', day], queryFn: () => api.revision.queue.query({}) }));

	let rating = $state<Record<string, number>>({});
	let busy = $state<string | null>(null);

	async function review(topicId: string) {
		busy = topicId;
		try {
			await api.revision.review.mutate({ topicId, grade: rating[topicId] ?? 3 });
			await queue.refetch();
		} finally {
			busy = null;
		}
	}
</script>

<header class="head">
	<h1>Revision</h1>
	{#if queue.data}<span class="meta">{queue.data.items.filter((i) => i.state === 'due').length} due · {queue.data.items.length} scheduled</span>{/if}
</header>

{#if queue.isLoading}
	<Loading />
{:else if queue.error}
	<ErrorState retry={() => queue.refetch()} />
{:else if !queue.data || queue.data.items.length === 0}
	<EmptyState title="Nothing to review" detail="Complete a few topics first — the scheduler builds itself from what you learn." />
{:else}
	<ul class="queue">
		{#each queue.data.items as item (item.topicId)}
			<li class="surface-card" class:overdue={item.state === 'due'}>
				<div class="row">
					<a href={`/app/learn/${item.topicId}`}>{item.title}</a>
					<span class="badge {item.state}">{item.state}</span>
				</div>
				<p class="meta">
					{item.domain} · mastery {item.mastery}% · reviewed {item.reviewCount}× · interval {item.intervalDays}d
					{#if item.overdueDays > 0}· <span class="overdue">{item.overdueDays}d overdue</span>{/if}
				</p>
				<div class="grade">
					{#each [1, 2, 3, 4, 5] as grade (grade)}
						<label class="cx" class:on={(rating[item.topicId] ?? 0) === grade}>
							<input type="radio" name={item.topicId} bind:group={rating[item.topicId]} value={grade} />
							{['', 'Blank', 'Hard', 'Ok', 'Good', 'Easy'][grade]}
						</label>
					{/each}
					<button type="button" disabled={busy === item.topicId} onclick={() => review(item.topicId)}>{busy === item.topicId ? '…' : 'Log review'}</button>
				</div>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
	h1 { margin: 0; }
	.meta { color: var(--text-muted); font-size: 12.5px; }
	.queue { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; max-width: 760px; }
	.queue li { padding: 16px 18px; display: grid; gap: 8px; }
	.queue li.overdue { border-color: var(--warning); }
	.row { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; }
	.row a { color: var(--text); font-weight: 540; font-size: 14.5px; text-decoration: none; }
	.row a:hover { color: var(--accent); }
	.badge { font-family: var(--font-mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.07em; padding: 2px 8px; border-radius: 99px; }
	.badge.due { background: var(--warning-soft); color: var(--warning); }
	.badge.soon { background: var(--accent-soft); color: var(--accent); }
	.badge.fresh { background: var(--success-soft); color: var(--success); }
	.overdue { color: var(--warning); }
	.grade { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
	label.cx {
		display: inline-flex; align-items: center; min-height: 34px; padding: 0 12px; border-radius: 99px;
		border: 1px solid var(--border-strong); background: var(--surface-3); font-size: 12.5px; cursor: pointer; color: var(--text-secondary);
	}
	label.cx.on { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
	label.cx input { display: none; }
	.grade button { min-height: 34px; padding: 0 14px; border-radius: 99px; border: none; background: var(--accent); color: var(--accent-contrast); font-size: 12.5px; font-weight: 540; margin-left: auto; }
</style>
