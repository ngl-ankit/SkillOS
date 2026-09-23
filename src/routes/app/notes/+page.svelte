<script lang="ts">
	
	import { createQuery } from '@tanstack/svelte-query';
	import EmptyState from '$components/EmptyState.svelte';
	import ErrorState from '$components/ErrorState.svelte';
	import Loading from '$components/Loading.svelte';
import { api } from '$lib/trpc';
	import { relTime } from '$lib/utils';

	const notes = createQuery(() => ({
		queryKey: ['notes'],
		queryFn: () => api.notes.list.query({ query: debouncedQuery, filter })
	}));

	let filter = $state<'all' | 'topic' | 'resource' | 'project' | 'unlinked'>('all');
	let query = $state('');
	let debouncedQuery = $state('');
	let debounceTimer: ReturnType<typeof setTimeout>;

	function onInput() {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => (debouncedQuery = query), 220);
	}

	let title = $state('');
	let body = $state('');
	let creating = $state(false);

	async function create() {
		if (body.trim().length === 0) return;
		creating = true;
		try {
			await api.notes.create.mutate({ title: title.trim() || 'Note', body: body.trim() });
			title = '';
			body = '';
			await notes.refetch();
		} finally {
			creating = false;
		}
	}

	async function remove(id: string) {
		await api.notes.remove.mutate({ id });
		await notes.refetch();
	}
</script>

<header class="head">
	<h1>Notes</h1>
	<input type="search" bind:value={query} oninput={onInput} placeholder="Search notes…" maxlength="160" />
</header>

<form class="surface-card new" onsubmit={(e) => { e.preventDefault(); void create(); }}>
	<input type="text" bind:value={title} maxlength="160" placeholder="Title" />
	<textarea rows="3" bind:value={body} maxlength="20000" placeholder="Write a note…" required></textarea>
	<button type="submit" disabled={creating}>{creating ? 'Saving…' : 'Add note'}</button>
</form>

<div class="chips">
	{#each [['all', 'All'], ['topic', 'By topic'], ['resource', 'By resource'], ['project', 'By project'], ['unlinked', 'Unlinked']] as [value, label] (value)}
		<button type="button" class:on={filter === value} onclick={() => (filter = value as typeof filter)}>{label}</button>
	{/each}
</div>

{#if notes.isLoading}
	<Loading />
{:else if notes.error}
	<ErrorState retry={() => notes.refetch()} />
{:else if !notes.data || notes.data.length === 0}
	<EmptyState title="No notes yet" detail="Notes attach to topics, resources and projects — write the first one above." />
{:else}
	<ul class="grid">
		{#each notes.data as note (note.id)}
			<li class="surface-card">
				<div class="row">
					<strong>{note.title}</strong>
					<button class="del" type="button" onclick={() => remove(note.id)}>✕</button>
				</div>
				{#if note.topicTitle}<span class="tag">topic · {note.topicTitle}</span>{/if}
				{#if note.projectTitle}<span class="tag">project · {note.projectTitle}</span>{/if}
				<p>{note.excerpt}{note.body.length > 180 ? '…' : ''}</p>
				<span class="meta">{relTime(note.updatedAt)}</span>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.head { display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
	h1 { margin: 0; }
	.head input {
		min-height: 42px; padding: 0 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-strong);
		background: var(--surface-3); color: var(--text); font-size: 14px; width: min(300px, 100%);
	}
	.new { margin-bottom: 14px; padding: 16px 18px; display: grid; gap: 10px; max-width: 760px; }
	.new input, .new textarea {
		padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-strong);
		background: var(--surface-3); color: var(--text); font-size: 14px; resize: vertical;
	}
	.new button { justify-self: start; min-height: 40px; padding: 0 18px; border: none; border-radius: var(--radius-sm); background: var(--accent); color: var(--accent-contrast); font-weight: 550; font-size: 13.5px; }
	.chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
	.chips button {
		min-height: 34px; padding: 0 14px; border-radius: 99px; border: 1px solid var(--border-strong);
		background: var(--surface-3); color: var(--text-secondary); font-size: 12.5px;
	}
	.chips button.on { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
	.grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
	.grid li { padding: 16px 18px; display: grid; gap: 8px; align-content: start; }
	.row { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; }
	.del { background: none; border: none; color: var(--text-faint); font-size: 13px; }
	.del:hover { color: var(--danger); }
	.tag { justify-self: start; font-family: var(--font-mono); font-size: 10.5px; color: var(--accent); background: var(--accent-soft); padding: 2px 8px; border-radius: 99px; }
	.grid p { margin: 0; font-size: 13px; color: var(--text-secondary); }
	.meta { font-size: 11px; color: var(--text-faint); }
</style>
