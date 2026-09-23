<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { api } from '$lib/trpc';
	import { cx } from '$lib/utils';

	let { open = $bindable(false) }: { open?: boolean } = $props();
	let query = $state('');
	let hits = $state<{ id: string; kind: string; title: string; snippet: string; href: string }[]>([]);
	let busy = $state(false);
	let active = $state(0);
	let inputEl: HTMLInputElement | undefined = $state();

	const quickLinks = [
		{ label: 'Dashboard', href: '/app' },
		{ label: 'Roadmap', href: '/app/roadmap' },
		{ label: 'Learn', href: '/app/learn' },
		{ label: 'Resources', href: '/app/resources' },
		{ label: 'Projects', href: '/app/projects' },
		{ label: 'Revision', href: '/app/revision' },
		{ label: 'Assessments', href: '/app/assessments' },
		{ label: '3D Universe', href: '/app/universe' },
		{ label: 'AI Mentor', href: '/app/mentor' },
		{ label: 'Notes', href: '/app/notes' },
		{ label: 'Settings', href: '/app/settings' }
	];

	function show() {
		open = true;
		void tick().then(() => inputEl?.focus());
	}

	onMount(() => {
		document.addEventListener('open-palette', show);
		return () => document.removeEventListener('open-palette', show);
	});

	async function search() {
		const q = query.trim();
		if (q.length < 2) {
			hits = [];
			return;
		}
		busy = true;
		try {
			const result = await api.search.query.query({ q });
			hits = result.hits;
			active = 0;
		} catch {
			hits = [];
		} finally {
			busy = false;
		}
	}

	function choose(href: string) {
		open = false;
		query = '';
		hits = [];
		void goto(href);
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') open = false;
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			active = Math.min(active + 1, hits.length - 1);
		}
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			active = Math.max(active - 1, 0);
		}
		if (event.key === 'Enter' && hits[active]) choose(hits[active].href);
	}
</script>

{#if open}
	<button class="backdrop" type="button" aria-label="Close search" onclick={() => (open = false)}></button>
	<div class="palette surface-card" role="dialog" aria-modal="true" aria-label="Command palette">
		<div class="input-row">
			<input bind:this={inputEl} bind:value={query} oninput={search} onkeydown={onKeydown} type="text" placeholder="Search topics, notes, resources…" maxlength="120" />
			<kbd>esc</kbd>
		</div>

		{#if busy}
			<p class="hint">Searching…</p>
		{:else if hits.length > 0}
			<ul class="hits">
				{#each hits as hit, index (hit.kind + hit.id)}
					<li>
						<button type="button" class:on={index === active} onclick={() => choose(hit.href)}>
							<span class="kind">{hit.kind}</span>
							<span class="title">{hit.title}</span>
							<span class="snippet">{hit.snippet}</span>
						</button>
					</li>
				{/each}
			</ul>
		{:else if query.trim().length >= 2}
			<p class="hint">No matches. Try a topic name or a word from your notes.</p>
		{:else}
			<ul class="hits">
				{#each quickLinks as link (link.href)}
					<li><button type="button" onclick={() => choose(link.href)}><span class="kind">go</span><span class="title">{link.label}</span></button></li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 60;
		background: rgb(0 0 0 / 55%);
		border: none;
		backdrop-filter: blur(2px);
	}
	.palette {
		position: fixed;
		z-index: 61;
		left: 50%;
		top: clamp(8vh, 14vh, 18vh);
		transform: translateX(-50%);
		width: min(600px, calc(100vw - 24px));
		padding: 10px;
		box-shadow: var(--shadow-lg);
		animation: os-scale-in var(--dur-base) var(--ease-out) both;
	}
	.input-row { display: flex; align-items: center; gap: 8px; }
	input {
		flex: 1;
		min-height: 44px;
		padding: 0 12px;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-sm);
		background: var(--surface-3);
		color: var(--text);
		font-size: 15px;
	}
	input:focus { border-color: var(--accent); outline: none; }
	kbd { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); border: 1px solid var(--border); border-radius: 4px; padding: 2px 5px; }
	.hits { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 2px; max-height: 46vh; overflow-y: auto; }
	.hits button {
		display: grid;
		grid-template-columns: 64px 1fr;
		grid-template-rows: auto auto;
		gap: 0 10px;
		width: 100%;
		text-align: left;
		padding: 9px 10px;
		border-radius: var(--radius-xs);
		border: none;
		background: transparent;
		color: var(--text);
	}
	.hits button:hover, .hits button.on { background: var(--surface-3); }
	.kind { grid-row: 1 / span 2; font-family: var(--font-mono); font-size: 10px; color: var(--accent); text-transform: uppercase; letter-spacing: 0.08em; align-self: center; }
	.title { font-size: 14px; font-weight: 520; }
	.snippet { font-size: 12px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.hint { margin: 12px 4px; font-size: 13px; color: var(--text-muted); }
</style>
