<script lang="ts">
	
	import { createQuery } from '@tanstack/svelte-query';
import { page } from '$app/state';
	import EmptyState from '$components/EmptyState.svelte';
	import ErrorState from '$components/ErrorState.svelte';
	import Loading from '$components/Loading.svelte';
	import { api } from '$lib/trpc';
	import { cx } from '$lib/utils';

	const topicId = $derived(new URLSearchParams(page.url.search).get('topicId') ?? '');
	const overview = createQuery(() => ({ queryKey: ['assessments'], queryFn: () => api.assessment.overview.query() }));

	const assessment = createQuery(() => ({
		queryKey: ['assessment', topicId],
		queryFn: () => api.assessment.forTopic.query({ topicId }),
		enabled: topicId.length > 0
	}));

	let answers = $state<Record<string, string>>({});
	let result = $state<{ score: number; passed: boolean } | null>(null);
	let busy = $state(false);

	async function submit() {
		if (!assessment.data) return;
		busy = true;
		try {
			const attempt = await api.assessment.submit.mutate({ assessmentId: assessment.data.assessment.id, answers });
			result = { score: attempt.score, passed: attempt.passed };
			await Promise.all([assessment.refetch(), overview.refetch()]);
		} finally {
			busy = false;
		}
	}
</script>

<header class="head">
	<h1>Assessments</h1>
	{#if overview.data}<span class="meta">{overview.data.count} attempts · avg {overview.data.average ?? '—'}% · pass rate {overview.data.passRate ?? '—'}%</span>{/if}
</header>

{#if topicId && assessment.data}
	<section class="surface-card take">
		<h2>{assessment.data.assessment.title}</h2>
		<p class="meta">{assessment.data.assessment.description} · pass ≥ {assessment.data.assessment.passScore}%</p>
		{#each assessment.data.questions as question (question.id)}
			<div class="q">
				<p class="prompt">{question.position}. {question.prompt}</p>
				{#if question.code}<pre class="code"><code>{question.code}</code></pre>{/if}
				{#if question.type === 'mcq' && question.options}
					<div class="opts">
						{#each question.options as option (option.key)}
							<label class="opt" class:on={answers[question.id] === option.key}>
								<input type="radio" name={question.id} value={option.key} bind:group={answers[question.id]} />
								{option.label}
							</label>
						{/each}
					</div>
				{:else if question.type === 'true_false'}
					<div class="opts">
						{#each ['true', 'false'] as option (option)}
							<label class="opt" class:on={answers[question.id] === option}>
								<input type="radio" name={question.id} value={option} bind:group={answers[question.id]} />
								{option === 'true' ? 'True' : 'False'}
							</label>
						{/each}
					</div>
				{:else}
					<textarea rows={question.type === 'code' ? 5 : 3} bind:value={answers[question.id]} placeholder={question.type === 'code' ? 'Write your code…' : 'Answer in your own words…'}></textarea>
				{/if}
			</div>
		{/each}
		<button type="button" disabled={busy} onclick={submit}>{busy ? 'Grading…' : 'Submit answers'}</button>
		{#if result}
			<p class="result" class:pass={result.passed}>{result.passed ? 'Passed' : 'Not passed'} — {result.score}%</p>
		{/if}
	</section>
{:else if topicId && assessment.isLoading}
	<Loading compact />
{/if}

{#if overview.isLoading}
	<Loading />
{:else if overview.error}
	<ErrorState retry={() => overview.refetch()} />
{:else if overview.data && overview.data.recent.length > 0}
	<section class="surface-card history">
		<h3>Recent attempts</h3>
		<ul class="mini">
			{#each overview.data.recent as row (row.title + String(row.at))}
				<li><span>{row.title}</span><span class="score" class:pass={row.passed}>{row.score}%</span></li>
			{/each}
		</ul>
		{#if overview.data.weakestConcepts.length > 0}
			<p class="meta">Weakest concepts: {overview.data.weakestConcepts.map((w) => w.concept).join(', ')}</p>
		{/if}
	</section>
{:else if !topicId}
	<EmptyState title="No attempts yet" detail="Open a topic and take its knowledge check — results and scheduling happen here." />
{/if}

<style>
	.head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
	h1 { margin: 0; }
	h2 { margin: 0 0 4px; font-size: 18px; }
	h3 { margin: 0 0 10px; font-size: 14px; color: var(--text-secondary); }
	.meta { color: var(--text-muted); font-size: 12.5px; }
	.take { padding: 22px; max-width: 760px; display: grid; gap: 16px; margin-bottom: 14px; }
	.q { display: grid; gap: 8px; border-top: 1px solid var(--border); padding-top: 14px; }
	.prompt { margin: 0; font-size: 14px; }
	.code { background: var(--surface-1); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px; overflow-x: auto; font-family: var(--font-mono); font-size: 12.5px; }
	.opts { display: grid; gap: 6px; }
	.opt { display: flex; gap: 8px; align-items: center; min-height: 40px; padding: 0 12px; border: 1px solid var(--border-strong); border-radius: var(--radius-xs); font-size: 13.5px; cursor: pointer; }
	.opt.on { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
	.opt input { accent-color: var(--accent); }
	textarea { padding: 8px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-strong); background: var(--surface-3); color: var(--text); font-size: 13.5px; resize: vertical; }
	.take > button { justify-self: start; min-height: 44px; padding: 0 20px; border: none; border-radius: var(--radius-sm); background: var(--accent); color: var(--accent-contrast); font-weight: 550; }
	.result { font-weight: 560; }
	.result.pass { color: var(--success); }
	.history { padding: 20px; max-width: 760px; margin-bottom: 14px; }
	.mini { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
	.mini li { display: grid; gap: 4px; border-top: 1px solid var(--border); padding-top: 10px; }
	.history .mini li { display: flex; justify-content: space-between; }
	.score { font-family: var(--font-mono); font-size: 12.5px; color: var(--text-muted); }
	.score.pass { color: var(--success); }
</style>
