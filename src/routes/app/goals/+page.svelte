<script lang="ts">
	
	import { createQuery } from '@tanstack/svelte-query';
	import EmptyState from '$components/EmptyState.svelte';
	import ErrorState from '$components/ErrorState.svelte';
	import Loading from '$components/Loading.svelte';
	import ProgressBar from '$components/ProgressBar.svelte';
import { api } from '$lib/trpc';
	import { formatDate, todayISO } from '$lib/utils';

	const goals = createQuery(() => ({ queryKey: ['goals'], queryFn: () => api.goals.list.query({}) }));

	let title = $state('');
	let level = $state<'beginner' | 'intermediate' | 'advanced'>('beginner');
	let deadline = $state('');
	let creating = $state(false);
	let error = $state('');

	async function create(event: SubmitEvent) {
		event.preventDefault();
		if (title.trim().length < 3) return;
		creating = true;
		error = '';
		try {
			await api.goals.create.mutate({ title: title.trim(), level, deadline: deadline || null, setPrimary: true, today: todayISO() });
			title = '';
			deadline = '';
			await goals.refetch();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not create the goal.';
		} finally {
			creating = false;
		}
	}
</script>

<h1>Goals</h1>

{#if goals.isLoading}
	<Loading />
{:else if goals.error}
	<ErrorState retry={() => goals.refetch()} />
{:else}
	<section class="list">
		{#if goals.data && goals.data.length > 0}
			{#each goals.data as goal (goal.id)}
				<article class="surface-card goal" class:primary={goal.isPrimary}>
					<div class="row">
						<div>
							{#if goal.isPrimary}<span class="tag">primary</span>{/if}
							<h3>{goal.title}</h3>
							<p class="meta">
								{goal.level}
								{#if goal.deadline} · by {formatDate(goal.deadline)}{/if}
								{#if goal.targetRole} · {goal.targetRole}{/if}
							</p>
						</div>
						<div class="actions">
							{#if !goal.isPrimary}
								<button type="button" onclick={() => api.goals.setPrimary.mutate({ id: goal.id }).then(() => goals.refetch())}>Make primary</button>
							{/if}
							<button type="button" class="danger" onclick={() => api.goals.remove.mutate({ id: goal.id }).then(() => goals.refetch())}>Delete</button>
						</div>
					</div>
					{#if goal.progress}
						<ProgressBar value={goal.progress.percent} size="sm" />
						<p class="meta">{goal.progress.completed}/{goal.progress.total} topics · {goal.progress.percent}%</p>
					{/if}
				</article>
			{/each}
		{:else}
			<EmptyState title="No goals yet" detail="Add the first one — a roadmap is generated from it automatically." />
		{/if}
	</section>

	<form class="surface-card new" onsubmit={create}>
		<h3>New goal</h3>
		<input type="text" bind:value={title} required minlength="3" maxlength="200" placeholder="e.g. Ship a full-stack project portfolio" />
		<div class="fields">
			<label>
				<span>Level</span>
				<select bind:value={level}>
					<option value="beginner">Beginner</option>
					<option value="intermediate">Intermediate</option>
					<option value="advanced">Advanced</option>
				</select>
			</label>
			<label>
				<span>Target date (optional)</span>
				<input type="date" bind:value={deadline} />
			</label>
		</div>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<button type="submit" disabled={creating}>{creating ? 'Creating…' : 'Create goal'}</button>
	</form>
{/if}

<style>
	h1 { margin: 0 0 16px; }
	.list { display: grid; gap: 12px; max-width: 760px; }
	.goal { padding: 20px; }
	.goal.primary { border-color: var(--accent); box-shadow: var(--shadow-glow); }
	.row { display: flex; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
	h3 { margin: 4px 0 4px; }
	.meta { margin: 0; color: var(--text-muted); font-size: 12.5px; }
	.tag { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent); background: var(--accent-soft); padding: 2px 8px; border-radius: 99px; }
	.actions { display: flex; gap: 8px; align-items: flex-start; }
	button {
		min-height: 36px; padding: 0 14px; border-radius: var(--radius-xs);
		border: 1px solid var(--border-strong); background: var(--surface-3); color: var(--text); font-size: 12.5px;
	}
	button.danger { color: var(--danger); }
	.new { margin-top: 18px; padding: 20px; max-width: 760px; display: grid; gap: 12px; }
	.new h3 { margin: 0; }
	input, select {
		min-height: 44px; padding: 0 12px; border-radius: var(--radius-sm);
		border: 1px solid var(--border-strong); background: var(--surface-3); color: var(--text); font-size: 14px; width: 100%;
	}
	.fields { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
	label { display: grid; gap: 6px; font-size: 12.5px; color: var(--text-muted); }
	.error { color: var(--danger); font-size: 13px; margin: 0; }
	.new button {
		justify-self: start; border: none; background: var(--accent); color: var(--accent-contrast); font-weight: 550;
	}
</style>
