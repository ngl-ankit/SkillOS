<script lang="ts">
	
	import { createQuery } from '@tanstack/svelte-query';
import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import EmptyState from '$components/EmptyState.svelte';
	import ErrorState from '$components/ErrorState.svelte';
	import Loading from '$components/Loading.svelte';
	import ProgressBar from '$components/ProgressBar.svelte';
	import StatGrid from '$components/StatGrid.svelte';
	import { api } from '$lib/trpc';
	import { humanMinutes, pct, todayISO } from '$lib/utils';

	const today = todayISO();
	const todayQ = createQuery(() => ({
		queryKey: ['today', today],
		queryFn: () => api.plan.today.query({ day: today })
	}));
	const me = createQuery(() => ({ queryKey: ['me'], queryFn: () => api.profile.me.query() }));

	let redirected = $state(false);
	$effect(() => {
		if (todayQ.data && !todayQ.data.onboarded && !redirected) {
			redirected = true;
			void goto('/app/onboarding');
		}
	});

	let completing = $state<string | null>(null);
	async function completeItem(id: string) {
		completing = id;
		try {
			await api.plan.completeItem.mutate({ itemId: id });
			await todayQ.refetch();
		} finally {
			completing = null;
		}
	}
</script>

<header class="head">
	<div>
		<p class="meta">{todayQ.data?.day}</p>
		<h1>{todayQ.data?.greeting ?? 'Hello'}, {todayQ.data?.profileName || me.data?.profile?.displayName || ''}</h1>
		{#if todayQ.data?.goal}
			<p class="goal-line">
				{todayQ.data.goal.title}
				{#if todayQ.data.phase}<span class="phase"> · {todayQ.data.phase.title} (phase {todayQ.data.phase.index} of {todayQ.data.phase.total})</span>{/if}
			</p>
		{/if}
	</div>
	<a class="checkin" href="/app/checkin">Daily check-in</a>
</header>

{#if todayQ.isLoading}
	<Loading detail="Composing today's plan…" />
{:else if todayQ.error}
	<ErrorState retry={() => todayQ.refetch()} />
{:else if todayQ.data}
	{#if !todayQ.data.plan}
		<EmptyState
			title="No plan for today yet"
			detail="Generate one from your roadmap — it fits your daily minutes automatically."
			actionLabel="Build today's plan"
			onAction={() => api.plan.regenerate.mutate({ useAi: false }).then(() => todayQ.refetch())}
		/>
	{:else}
		<section class="plan surface-card">
			<div class="plan-head">
				<div>
					<h2>{todayQ.data.plan.focus}</h2>
					<p class="meta">{humanMinutes(todayQ.data.plan.plannedMinutes)} planned of {humanMinutes(todayQ.data.plan.budgetMinutes)} budget</p>
				</div>
				<ProgressBar value={todayQ.data.plan.items.filter((i) => i.status === 'done').length} max={Math.max(1, todayQ.data.plan.items.length)} />
			</div>
			<ul class="items">
				{#each todayQ.data.plan.items as item (item.id)}
					<li class:done={item.status === 'done'}>
						<div class="item-main">
							<span class="kind">{item.kind}</span>
							<div>
								<p class="title">{item.title}</p>
								{#if item.detail}<p class="detail">{item.detail}</p>{/if}
							</div>
						</div>
						<div class="item-side">
							<span class="minutes">{humanMinutes(item.minutes)}</span>
							{#if item.status === 'pending'}
								<button type="button" disabled={completing === item.id} onclick={() => completeItem(item.id)}>{completing === item.id ? '…' : 'Done'}</button>
							{:else}
								<button type="button" class="ghost" onclick={() => api.plan.reopenItem.mutate({ itemId: item.id }).then(() => todayQ.refetch())}>Reopen</button>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
			{#if todayQ.data.plan.rationale.length > 0}
				<details class="why">
					<summary>Why this plan</summary>
					<ul>{#each todayQ.data.plan.rationale as reason}<li>{reason}</li>{/each}</ul>
				</details>
			{/if}
		</section>
	{/if}

	<section class="grid">
		<article class="surface-card">
			<h3>Progress</h3>
			{#if todayQ.data.progress}
				<p class="big">{todayQ.data.progress.percent}%</p>
				<ProgressBar value={todayQ.data.progress.percent} tone="success" />
				<p class="meta">{todayQ.data.progress.completed} of {todayQ.data.progress.total} topics · {humanMinutes(todayQ.data.progress.estimatedMinutesRemaining)} remaining</p>
			{:else}
				<p class="meta">No roadmap yet.</p>
			{/if}
		</article>

		<article class="surface-card">
			<h3>Revision due</h3>
			{#if todayQ.data.revision.length === 0}
				<p class="meta">Nothing due — the queue is clear.</p>
			{:else}
				<ul class="mini">
					{#each todayQ.data.revision.slice(0, 4) as item (item.topicId)}
						<li><a href={`/app/learn/${item.topicId}`}>{item.title}</a><span class="badge due">{item.state}</span></li>
					{/each}
				</ul>
			{/if}
		</article>

		<article class="surface-card">
			<h3>Weak areas</h3>
			{#if todayQ.data.weak.length === 0}
				<p class="meta">No weak topics detected. Take an assessment to measure retention.</p>
			{:else}
				<ul class="mini">
					{#each todayQ.data.weak.slice(0, 4) as item (item.topicId)}
						<li><a href={`/app/learn/${item.topicId}`}>{item.title}</a><span class="badge warn">{item.mastery}%</span></li>
					{/each}
				</ul>
			{/if}
		</article>

		<article class="surface-card">
			<h3>Streak & momentum</h3>
			<StatGrid
				items={[
					{ label: 'Streak', value: `${todayQ.data.streak.current}d`, hint: `best ${todayQ.data.streak.longest}d` },
					{ label: 'This week', value: humanMinutes(todayQ.data.minutesThisWeek) },
					...(todayQ.data.daysUntilDeadline !== null ? [{ label: 'Deadline', value: `${todayQ.data.daysUntilDeadline}d left` }] : [])
				]}
			/>
			{#if todayQ.data.currentTopic}
				<a class="cta" href={`/app/learn/${todayQ.data.currentTopic.topicId}`}>Continue: {todayQ.data.currentTopic.title}</a>
			{/if}
		</article>
	</section>

	{#if todayQ.data.nextMilestone}
		<section class="milestone surface-card">
			<span class="meta">Next milestone — {todayQ.data.nextMilestone.phaseTitle}</span>
			<h3>{todayQ.data.nextMilestone.title}</h3>
			<p class="meta">{todayQ.data.nextMilestone.detail} · {todayQ.data.nextMilestone.remainingTopics} topic(s) to go</p>
		</section>
	{/if}
{/if}

<style>
	.head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
	h1 { margin: 0; font-size: clamp(24px, 4vw, 34px); }
	.goal-line { margin: 4px 0 0; color: var(--text-secondary); font-size: 14px; }
	.phase { color: var(--text-muted); }
	.checkin {
		display: inline-flex; align-items: center; min-height: 42px; padding: 0 18px;
		border-radius: var(--radius-sm); background: var(--accent); color: var(--accent-contrast);
		font-weight: 550; font-size: 14px; text-decoration: none;
	}
	.plan { padding: 20px; margin-bottom: 16px; }
	.plan-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 14px; flex-wrap: wrap; }
	.plan-head h2 { margin: 0 0 4px; font-size: 18px; }
	.items { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
	.items li {
		display: flex; justify-content: space-between; gap: 14px; align-items: center;
		padding: 12px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm);
		background: var(--surface-3);
	}
	.items li.done { opacity: 0.55; }
	.items li.done .title { text-decoration: line-through; }
	.item-main { display: flex; gap: 10px; align-items: flex-start; min-width: 0; }
	.kind {
		font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em;
		color: var(--accent); background: var(--accent-soft); border-radius: 4px; padding: 3px 6px; flex: none; margin-top: 2px;
	}
	.title { margin: 0; font-size: 14px; font-weight: 520; }
	.detail { margin: 2px 0 0; font-size: 12.5px; color: var(--text-muted); }
	.item-side { display: flex; align-items: center; gap: 10px; flex: none; }
	.minutes { font-family: var(--font-mono); font-size: 12px; color: var(--text-muted); }
	.items button {
		min-height: 36px; padding: 0 14px; border-radius: var(--radius-xs); border: 1px solid transparent;
		background: var(--accent); color: var(--accent-contrast); font-size: 13px; font-weight: 540;
	}
	.items button.ghost { background: transparent; border-color: var(--border-strong); color: var(--text-muted); }
	.why { margin-top: 14px; font-size: 13px; color: var(--text-muted); }
	.why summary { cursor: pointer; }
	.why ul { margin: 8px 0 0; padding-left: 18px; }
	.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
	.grid article { padding: 18px; }
	.grid h3 { margin: 0 0 10px; font-size: 14px; color: var(--text-secondary); }
	.big { margin: 0 0 8px; font-size: 30px; font-weight: 580; letter-spacing: -0.02em; }
	.meta { color: var(--text-muted); font-size: 12.5px; margin: 0; }
	header .meta { text-transform: uppercase; letter-spacing: 0.08em; font-size: 11px; }
	.mini { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
	.mini li { display: flex; justify-content: space-between; gap: 10px; font-size: 13.5px; }
	.mini a { color: var(--text); text-decoration: none; }
	.mini a:hover { color: var(--accent); }
	.badge { font-family: var(--font-mono); font-size: 11px; padding: 2px 7px; border-radius: 99px; }
	.badge.due { background: var(--warning-soft); color: var(--warning); }
	.badge.warn { background: var(--danger-soft); color: var(--danger); }
	.cta {
		display: inline-flex; align-items: center; min-height: 40px; padding: 0 16px; margin-top: 12px;
		border-radius: var(--radius-sm); border: 1px solid var(--border-strong);
		color: var(--text); font-size: 13.5px; text-decoration: none;
	}
	.milestone { padding: 20px; margin-top: 16px; }
	.milestone .meta { text-transform: uppercase; letter-spacing: 0.08em; font-size: 11px; }
	.milestone h3 { margin: 6px 0 4px; }
</style>
