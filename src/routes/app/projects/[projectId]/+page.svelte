<script lang="ts">
		
	import { createQuery } from '@tanstack/svelte-query';
	import ErrorState from '$components/ErrorState.svelte';
	import Loading from '$components/Loading.svelte';
	import ProgressBar from '$components/ProgressBar.svelte';
import { api } from '$lib/trpc';
	import { humanHours, pct } from '$lib/utils';
import type { PageProps } from './$types';

	let { params }: PageProps = $props();
	const projectId = $derived(params.projectId);
	const detail = createQuery(() => ({
		queryKey: ['project', projectId],
		queryFn: () => api.projects.detail.query({ projectId }),
		enabled: Boolean(projectId)
	}));

	let repoUrl = $state('');
	let reflection = $state('');
	let noteBody = $state('');
	let busy = $state(false);
	let init = $state(false);

	$effect(() => {
		if (detail.data && !init) {
			init = true;
			repoUrl = detail.data.progress.repoUrl ?? '';
			reflection = detail.data.progress.reflection ?? '';
		}
	});

	async function toggleMilestone(index: number, done: boolean) {
		busy = true;
		try {
			await api.projects.setMilestone.mutate({ projectId, index, done });
			await detail.refetch();
		} finally {
			busy = false;
		}
	}

	async function saveMeta() {
		await api.projects.update.mutate({ projectId, repoUrl: repoUrl.trim() || null, reflection: reflection.trim() || null });
		await detail.refetch();
	}

	async function addNote() {
		if (noteBody.trim().length < 1) return;
		await api.projects.addNote.mutate({ projectId, body: noteBody.trim() });
		noteBody = '';
		await detail.refetch();
	}
</script>

{#if detail.isLoading}
	<Loading />
{:else if detail.error}
	<ErrorState retry={() => detail.refetch()} />
{:else if detail.data}
	{@const data = detail.data}
	<header class="head">
		<a class="crumb" href="/app/projects">← All projects</a>
		<h1>{data.project.title}</h1>
		<p class="meta">
			{data.project.difficulty}/5 · ~{humanHours(data.project.estimatedHours * 60)}
			{#if data.anchorTopic}· anchors <a href={`/app/learn/${data.anchorTopic.id}`}>{data.anchorTopic.title}</a>{/if}
		</p>
	</header>

	<div class="cols">
		<section class="surface-card">
			<h3>Goal</h3>
			<p>{data.project.goal}</p>
			<h3>Requirements</h3>
			<ul class="reqs">{#each data.project.requirements as requirement (requirement)}<li>{requirement}</li>{/each}</ul>
			{#if data.project.suggestedStack.length > 0}<p class="meta">Suggested stack: {data.project.suggestedStack.join(', ')}</p>{/if}

			<h3>Milestones</h3>
			<ProgressBar value={data.percent} />
			<ul class="milestones">
				{#each data.project.milestones as milestone, index (milestone.title)}
					<li>
						<label class="tick">
							<input type="checkbox" checked={data.progress.completedMilestones.includes(index)} disabled={busy} onchange={(e) => toggleMilestone(index, e.currentTarget.checked)} />
							<span><strong>{milestone.title}</strong><br /><span class="meta">{milestone.detail}</span></span>
						</label>
					</li>
				{/each}
			</ul>
		</section>

		<section class="surface-card">
			<h3>Status</h3>
			<p class="meta">{data.progress.status.replace('_', ' ')} · {data.percent}% · {data.minutesLogged} min logged</p>
			<label class="field"><span>Repository URL</span><input type="url" bind:value={repoUrl} placeholder="https://github.com/…" maxlength="300" /></label>
			<label class="field"><span>Reflection</span><textarea rows="3" maxlength="4000" bind:value={reflection} placeholder="What did you build? What was hard?"></textarea></label>
			<button type="button" onclick={saveMeta}>Save</button>

			<h3>Notes</h3>
			<textarea rows="3" maxlength="8000" bind:value={noteBody} placeholder="Attach a note to this project…"></textarea>
			<button type="button" onclick={addNote}>Add note</button>
			<ul class="notes">
				{#each data.notes as note (note.id)}<li><strong>{note.title}</strong><p>{note.body}</p></li>{/each}
			</ul>
		</section>
	</div>
{/if}

<style>
	.crumb { color: var(--text-muted); font-size: 13px; text-decoration: none; }
	.crumb:hover { color: var(--accent); }
	h1 { margin: 6px 0 4px; font-size: clamp(22px, 4vw, 30px); }
	.meta { color: var(--text-muted); font-size: 12.5px; }
	.meta a { color: var(--accent); }
	.cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; align-items: start; margin-top: 14px; }
	.cols > section { padding: 20px; display: grid; gap: 8px; }
	h3 { margin: 12px 0 4px; font-size: 14px; color: var(--text-secondary); }
	section > h3:first-child { margin-top: 0; }
	p { margin: 0; font-size: 14px; }
	.reqs { margin: 0; padding-left: 18px; font-size: 13.5px; }
	.milestones { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 12px; }
	.tick { display: flex; gap: 10px; align-items: flex-start; font-size: 13.5px; cursor: pointer; }
	.tick input { margin-top: 3px; accent-color: var(--accent); }
	.field { display: grid; gap: 6px; font-size: 12.5px; color: var(--text-muted); }
	input, textarea {
		padding: 8px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-strong);
		background: var(--surface-3); color: var(--text); font-size: 13.5px; resize: vertical;
	}
	button { justify-self: start; min-height: 38px; padding: 0 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-strong); background: var(--surface-3); color: var(--text); font-size: 13px; }
	.notes { list-style: none; margin: 4px 0 0; padding: 0; display: grid; gap: 10px; }
	.notes li { border-left: 2px solid var(--border-strong); padding-left: 10px; font-size: 13px; }
	.notes p { margin: 2px 0 0; color: var(--text-secondary); }
	@media (max-width: 1024px) { .cols { grid-template-columns: minmax(0, 1fr); } }
</style>
