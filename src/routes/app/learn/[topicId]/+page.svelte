<script lang="ts">
		
	import { createQuery } from '@tanstack/svelte-query';
	import ErrorState from '$components/ErrorState.svelte';
	import Loading from '$components/Loading.svelte';
	import ProgressBar from '$components/ProgressBar.svelte';
import { api } from '$lib/trpc';
	import { humanMinutes } from '$lib/utils';
import type { PageProps } from './$types';

	let { params }: PageProps = $props();
	const topicId = $derived(params.topicId);
	const workspace = createQuery(() => ({
		queryKey: ['topic', topicId],
		queryFn: () => api.topics.workspace.query({ topicId }),
		enabled: Boolean(topicId)
	}));

	let minutes = $state(0);
	let noteTitle = $state('');
	let noteBody = $state('');
	let practiceAnswers = $state<Record<number, string>>({});
	let practiceFeedback = $state<Record<number, string>>({});
	let busy = $state(false);

	async function togglePractice(index: number, done: boolean) {
		busy = true;
		try {
			await api.topics.togglePractice.mutate({ topicId, exerciseIndex: index, done, minutes: 0 });
			await workspace.refetch();
		} finally {
			busy = false;
		}
	}

	async function checkPractice(index: number) {
		const result = await api.topics.checkPractice.query({ topicId, exerciseIndex: index, answer: practiceAnswers[index] ?? '' });
		practiceFeedback = { ...practiceFeedback, [index]: `${result.ok ? '✓' : '—'} ${result.hint}` };
	}

	async function completeTopic() {
		busy = true;
		try {
			await api.topics.complete.mutate({ topicId, minutes, confidence: 4 });
			await workspace.refetch();
		} finally {
			busy = false;
		}
	}

	async function addNote() {
		if (noteBody.trim().length < 1) return;
		await api.topics.addNote.mutate({ topicId, title: noteTitle.trim() || 'Note', body: noteBody.trim() });
		noteTitle = '';
		noteBody = '';
		await workspace.refetch();
	}
</script>

{#if workspace.isLoading}
	<Loading detail="Loading topic…" />
{:else if workspace.error}
	<ErrorState retry={() => workspace.refetch()} />
{:else if workspace.data}
	{@const data = workspace.data}
	<header class="head">
		<a class="crumb" href="/app/learn">← All topics</a>
		<h1>{data.topic.title}</h1>
		<p class="meta">{data.topic.domain} · difficulty {data.topic.difficulty}/5 · {humanMinutes(data.topic.estimatedMinutes)} estimate{data.snapshot?.phaseTitle ? ` · ${data.snapshot.phaseTitle}` : ''}</p>
	</header>

	<div class="cols">
		<section class="surface-card">
			<h3>Why this matters</h3>
			<p class="prose-os">{data.whyItMatters}</p>
			<h3>Concepts</h3>
			<ul class="concepts">
				{#each data.topic.concepts as concept (concept)}<li>{concept}</li>{/each}
			</ul>
			<h3>Resources</h3>
			{#if data.resources.length === 0}<p class="meta">No curated resources for this topic.</p>{/if}
			<ul class="res">
				{#each data.resources as resource (resource.slug)}
					<li>
						<a href={resource.url} target="_blank" rel="noopener noreferrer">{resource.title}</a>
						<span class="meta">{resource.provider} · {resource.type} · {resource.cost} · {humanMinutes(resource.minutes)}{resource.role === 'primary' ? ' · primary' : ''}</span>
						<p class="why">{resource.why}</p>
					</li>
				{/each}
			</ul>
		</section>

		<section class="surface-card">
			<h3>Progress</h3>
			<ProgressBar value={data.progress.progressPct} />
			<p class="meta">{data.progress.progressPct}% · mastery {data.progress.mastery}% · {humanMinutes(data.progress.minutesSpent)} spent · reviewed {data.progress.reviewCount}×</p>
			<div class="actions">
				{#if data.progress.status !== 'completed'}
					<label class="meta">Minutes spent <input type="number" min="0" max="600" bind:value={minutes} /></label>
					<button type="button" disabled={busy} onclick={completeTopic}>Mark complete</button>
					<button type="button" class="ghost" onclick={() => api.topics.update.mutate({ topicId, progressPct: Math.min(100, data.progress.progressPct + 15), minutes }).then(() => workspace.refetch())}>+15% progress</button>
				{:else}
					<span class="done">Completed ✓</span>
					<button type="button" class="ghost" onclick={() => api.topics.reopen.mutate({ topicId }).then(() => workspace.refetch())}>Reopen</button>
				{/if}
			</div>
			{#if data.assessment}
				<a class="assess" href={`/app/assessments?topicId=${topicId}`}>Take the knowledge check ({data.assessment.questionCount} questions)</a>
			{/if}

			<h3>Practice</h3>
			{#each data.topic.practice as exercise, index (exercise.title)}
				<div class="exercise">
					<label class="tick">
						<input
							type="checkbox"
							checked={(data.progress.practiceDone ?? []).includes(index)}
							disabled={busy}
							onchange={(e) => togglePractice(index, e.currentTarget.checked)}
						/>
						<strong>{exercise.title}</strong>
					</label>
					<p class="prompt">{exercise.prompt}</p>
					{#if exercise.hint}<p class="meta">Hint: {exercise.hint}</p>{/if}
					<textarea rows="3" maxlength="6000" placeholder="Write your attempt…" bind:value={practiceAnswers[index]}></textarea>
					<div class="ex-actions">
						<button type="button" onclick={() => checkPractice(index)}>Check</button>
						{#if practiceFeedback[index]}<span class="meta feedback">{practiceFeedback[index]}</span>{/if}
					</div>
				</div>
			{/each}

			<h3>Notes</h3>
			<div class="note-form">
				<input type="text" maxlength="160" placeholder="Title" bind:value={noteTitle} />
				<textarea rows="3" maxlength="8000" placeholder="Write a note attached to this topic…" bind:value={noteBody}></textarea>
				<button type="button" onclick={addNote}>Save note</button>
			</div>
			<ul class="notes">
				{#each data.notes as note (note.id)}
					<li><strong>{note.title}</strong><p>{note.body}</p><span class="meta">{note.updatedAt instanceof Date ? note.updatedAt.toLocaleString() : ''}</span></li>
				{/each}
			</ul>
		</section>
	</div>
{/if}

<style>
	.head { margin-bottom: 16px; }
	.crumb { color: var(--text-muted); font-size: 13px; text-decoration: none; }
	.crumb:hover { color: var(--accent); }
	h1 { margin: 6px 0 4px; font-size: clamp(22px, 4vw, 30px); }
	.meta { color: var(--text-muted); font-size: 12.5px; }
	.cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; align-items: start; }
	.cols > section { padding: 20px; display: grid; gap: 8px; }
	h3 { margin: 14px 0 4px; font-size: 14px; color: var(--text-secondary); }
	section > h3:first-child { margin-top: 0; }
	.concepts { margin: 0; padding-left: 18px; font-size: 14px; }
	.res { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
	.res a { color: var(--accent); text-decoration: none; font-size: 14px; }
	.res a:hover { text-decoration: underline; }
	.res .meta { display: block; font-size: 11.5px; margin-top: 2px; }
	.why { margin: 4px 0 0; font-size: 12.5px; color: var(--text-muted); }
	.actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 8px; }
	.actions button { min-height: 40px; padding: 0 16px; border-radius: var(--radius-sm); border: none; background: var(--accent); color: var(--accent-contrast); font-size: 13.5px; font-weight: 540; }
	.actions button.ghost { background: transparent; border: 1px solid var(--border-strong); color: var(--text-muted); }
	.actions input { width: 90px; min-height: 38px; padding: 0 8px; border-radius: var(--radius-xs); border: 1px solid var(--border-strong); background: var(--surface-3); color: var(--text); }
	.done { color: var(--success); font-weight: 540; }
	.assess { margin-top: 10px; color: var(--accent); font-size: 13.5px; }
	.exercise { border-top: 1px solid var(--border); padding-top: 12px; margin-top: 8px; display: grid; gap: 6px; }
	.tick { display: flex; gap: 8px; align-items: center; font-size: 14px; cursor: pointer; }
	.tick input { accent-color: var(--accent); }
	.prompt { margin: 0; font-size: 13px; color: var(--text-secondary); }
	.exercise textarea { min-height: 70px; padding: 8px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-strong); background: var(--surface-3); color: var(--text); font-size: 13px; resize: vertical; }
	.ex-actions { display: flex; gap: 10px; align-items: center; }
	.ex-actions button { min-height: 34px; padding: 0 12px; border-radius: var(--radius-xs); border: 1px solid var(--border-strong); background: var(--surface-3); color: var(--text); font-size: 12.5px; }
	.feedback { color: var(--text-secondary); }
	.note-form { display: grid; gap: 8px; }
	.note-form input, .note-form textarea { padding: 8px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-strong); background: var(--surface-3); color: var(--text); font-size: 13.5px; resize: vertical; }
	.note-form button { justify-self: start; min-height: 36px; padding: 0 14px; border-radius: var(--radius-xs); border: 1px solid var(--border-strong); background: var(--surface-3); color: var(--text); font-size: 12.5px; }
	.notes { list-style: none; margin: 4px 0 0; padding: 0; display: grid; gap: 10px; }
	.notes li { border-left: 2px solid var(--border-strong); padding-left: 10px; font-size: 13px; }
	.notes p { margin: 2px 0; color: var(--text-secondary); }

	@media (max-width: 1024px) { .cols { grid-template-columns: minmax(0, 1fr); } }
</style>
