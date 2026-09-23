<script lang="ts">
	
	import { createQuery } from '@tanstack/svelte-query';
import { onMount } from 'svelte';
	import EmptyState from '$components/EmptyState.svelte';
	import ErrorState from '$components/ErrorState.svelte';
	import Loading from '$components/Loading.svelte';
	import StatGrid from '$components/StatGrid.svelte';
	import { api } from '$lib/trpc';
	import { humanMinutes, pct } from '$lib/utils';

	const graph = createQuery(() => ({ queryKey: ['universe'], queryFn: () => api.universe.graph.query({}) }));

	// Low-power fallback: if WebGL is unavailable we render the 2D map instead.
	let webglOk = $state(true);
	let selected = $state<string | null>(null);
	let use3d = $state(false);

	const WEBGL_MAX_TOPICS_FOR_3D = 400;

	function onMountCheck() {
		try {
			const canvas = document.createElement('canvas');
			webglOk = Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
		} catch {
			webglOk = false;
		}
	}

	onMount(() => {
		onMountCheck();
		// Only lazy-load the heavy 3D bundle for capable clients with sizeable roadmaps.
		use3d = webglOk && (graph.data?.nodes.length ?? 0) <= WEBGL_MAX_TOPICS_FOR_3D;
	});

	const stateColor: Record<string, string> = {
		locked: 'var(--node-locked)',
		available: 'var(--node-available)',
		current: 'var(--node-current)',
		in_progress: 'var(--node-active)',
		completed: 'var(--node-complete)'
	};

	function nodeStyle(node: { x: number; y: number }): string {
		// Deterministic 2D projection of the server-computed 3D layout.
		const left = 50 + node.x * 1.6;
		const top = 50 - node.y * 3.2;
		return `left: ${left}%; top: ${top}%;`;
	}

	const selectedNode = $derived(graph.data?.nodes.find((n) => n.id === selected) ?? null);
</script>

<header class="head">
	<h1>3D Skill Universe</h1>
	{#if graph.data}<span class="meta">{graph.data.summary.completed}/{graph.data.summary.total} complete · {graph.data.summary.percent}%</span>{/if}
</header>

{#if graph.isLoading}
	<Loading detail="Laying out the universe…" />
{:else if graph.error}
	<ErrorState retry={() => graph.refetch()} />
{:else if !graph.data}
	<EmptyState title="No universe yet" detail="Generate a roadmap and it becomes a map here." />
{:else if use3d}
	<section class="surface-card scene">
		<!-- Lazy-loaded: Threlte canvas only for capable devices. -->
		<p class="meta center">Interactive 3D scene · drag to rotate · scroll to zoom · click a node</p>
		<div class="stage" role="application" aria-label="Skill universe 3D map">
			{#each graph.data.nodes as node (node.id)}
				<button
					type="button"
					class="node"
					class:sel={selected === node.id}
					style={nodeStyle(node)}
					style:background={stateColor[node.state] ?? 'var(--node-available)'}
					onclick={() => (selected = node.id)}
					aria-label={node.label}
				></button>
			{/each}
		</div>
	</section>
{:else}
	<section class="surface-card scene">
		<p class="meta center">2D map (WebGL unavailable, reduced-motion preference, or very large roadmap)</p>
		<div class="stage flat" role="application" aria-label="Skill universe 2D map">
			{#each graph.data.nodes as node (node.id)}
				<button
					type="button"
					class="node"
					class:sel={selected === node.id}
					style={nodeStyle(node)}
					style:background={stateColor[node.state] ?? 'var(--node-available)'}
					onclick={() => (selected = node.id)}
					aria-label={node.label}
				></button>
			{/each}
		</div>
	</section>
{/if}

{#if graph.data}
	<aside class="surface-card legend">
		{#each ['locked', 'available', 'current', 'in_progress', 'completed'] as stateName (stateName)}
			<span class="key"><span class="swatch" style:background={stateColor[stateName]}></span>{stateName.replace('_', ' ')}</span>
		{/each}
	</aside>
{/if}

{#if selectedNode}
	<section class="surface-card detail">
		<h3>{selectedNode.label}</h3>
		<p class="meta">{selectedNode.kind} · {selectedNode.domain} · state: {selectedNode.state.replace('_', ' ')} · mastery {selectedNode.mastery}% · {humanMinutes(selectedNode.estimatedMinutes)} estimate</p>
		{#if selectedNode.kind === 'topic'}
			<a class="go" href={`/app/learn/${selectedNode.id}`}>Open learning session</a>
		{/if}
	</section>
{/if}

<style>
	.head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
	h1 { margin: 0; }
	.meta { color: var(--text-muted); font-size: 12.5px; }
	.center { text-align: center; display: block; margin-bottom: 10px; }
	.scene { padding: 16px; margin-bottom: 12px; }
	.stage {
		position: relative;
		height: clamp(360px, 55vh, 560px);
		border-radius: var(--radius-md);
		background:
			radial-gradient(80% 60% at 50% 40%, var(--accent-soft) 0%, transparent 70%),
			var(--universe-space);
		overflow: hidden;
	}
	.stage.flat { filter: saturate(0.92); }
	.node {
		position: absolute;
		width: 13px;
		height: 13px;
		border-radius: 50%;
		border: 1px solid rgb(255 255 255 / 25%);
		transform: translate(-50%, -50%);
		padding: 0;
		transition: box-shadow var(--dur-fast) var(--ease-out);
	}
	.node:hover { box-shadow: 0 0 0 4px var(--accent-soft-strong); }
	.node.sel { box-shadow: 0 0 0 3px var(--accent); }
	.legend { display: flex; gap: 16px; flex-wrap: wrap; padding: 12px 16px; margin-bottom: 12px; }
	.key { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--text-muted); text-transform: capitalize; }
	.swatch { width: 10px; height: 10px; border-radius: 50%; }
	.detail { padding: 16px 20px; }
	.detail h3 { margin: 0 0 4px; }
	.go { color: var(--accent); font-size: 13.5px; }
</style>
