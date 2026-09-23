<script lang="ts">
	
	import BookOpen from '@lucide/svelte/icons/book-open';
	import ClipboardCheck from '@lucide/svelte/icons/clipboard-check';
	import FolderKanban from '@lucide/svelte/icons/folder-kanban';
import House from '@lucide/svelte/icons/house';
	import Library from '@lucide/svelte/icons/library';
	import LogOut from '@lucide/svelte/icons/log-out';
	import MapIcon from '@lucide/svelte/icons/map';
	import NotebookPen from '@lucide/svelte/icons/notebook-pen';
	import Orbit from '@lucide/svelte/icons/orbit';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Search from '@lucide/svelte/icons/search';
	import Settings from '@lucide/svelte/icons/settings';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Target from '@lucide/svelte/icons/target';
	import { cx, initials } from '$lib/utils';

	type Props = { user: { id: string; name: string; email: string }; path: string; onSignOut: () => void };
	let { user, path, onSignOut }: Props = $props();

	const items = [
		{ href: '/app', label: 'Home', icon: House },
		{ href: '/app/goals', label: 'Goals', icon: Target },
		{ href: '/app/roadmap', label: 'Roadmap', icon: MapIcon },
		{ href: '/app/learn', label: 'Learn', icon: BookOpen },
		{ href: '/app/resources', label: 'Resources', icon: Library },
		{ href: '/app/projects', label: 'Projects', icon: FolderKanban },
		{ href: '/app/revision', label: 'Revision', icon: RotateCcw },
		{ href: '/app/assessments', label: 'Assessments', icon: ClipboardCheck },
		{ href: '/app/universe', label: '3D Universe', icon: Orbit },
		{ href: '/app/mentor', label: 'AI Mentor', icon: Sparkles },
		{ href: '/app/notes', label: 'Notes', icon: NotebookPen },
		{ href: '/app/settings', label: 'Settings', icon: Settings }
	];

	// Mobile keeps the five highest-frequency destinations; the rest live in the palette.
	const mobileItems = [items[0], items[3], items[9], items[10], items[11]];

	function isActive(href: string): boolean {
		return href === '/app' ? path === '/app' : path.startsWith(href);
	}
</script>

<!-- Desktop rail -->
<aside class="rail" aria-label="Primary">
	<a class="brand" href="/app">Skill<span>OS</span></a>
	<nav>
		{#each items as item (item.href)}
			<item.icon size={17} strokeWidth={1.7} />
			<a class:active={isActive(item.href)} href={item.href}>{item.label}</a>
		{/each}
	</nav>
	<div class="foot">
		<button class="palette" type="button" onclick={() => document.dispatchEvent(new CustomEvent('open-palette'))}>
			<Search size={15} strokeWidth={1.7} />
			<span>Search</span>
			<kbd>⌘K</kbd>
		</button>
		<div class="who">
			<span class="avatar" aria-hidden="true">{initials(user.name)}</span>
			<span class="meta">
				<span class="name">{user.name}</span>
				<button type="button" onclick={onSignOut}><LogOut size={13} strokeWidth={1.7} /> Sign out</button>
			</span>
		</div>
	</div>
</aside>

<!-- Mobile bottom bar -->
<nav class="tabbar" aria-label="Primary mobile">
	{#each mobileItems as item (item.href)}
		<a href={item.href} class:active={isActive(item.href)} aria-label={item.label}>
			<item.icon size={20} strokeWidth={1.7} />
			<span>{item.label}</span>
		</a>
	{/each}
</nav>

<style>
	.rail {
		position: sticky;
		top: 0;
		height: 100dvh;
		display: flex;
		flex-direction: column;
		gap: 18px;
		padding: 20px 14px;
		border-right: 1px solid var(--border);
		background: var(--surface-1);
	}
	.brand { font-weight: 620; letter-spacing: -0.03em; font-size: 17px; color: var(--text); text-decoration: none; padding-left: 8px; }
	.brand span { color: var(--accent); }
	nav { display: grid; gap: 2px; flex: 1; align-content: start; }
	.rail nav { position: relative; }
	.rail nav :global(svg) { display: none; }
	.rail nav a {
		display: block;
		padding: 8px 10px;
		border-radius: var(--radius-xs);
		color: var(--text-secondary);
		text-decoration: none;
		font-size: 13.5px;
		min-height: 36px;
	}
	.rail nav a:hover { background: var(--surface-3); color: var(--text); }
	.rail nav a.active { background: var(--accent-soft); color: var(--accent); font-weight: 540; }
	.foot { display: grid; gap: 12px; }
	.palette {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 38px;
		padding: 0 10px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		background: var(--surface-2);
		color: var(--text-muted);
		font-size: 13px;
	}
	.palette kbd { margin-left: auto; font-family: var(--font-mono); font-size: 10px; padding: 2px 5px; border: 1px solid var(--border); border-radius: 4px; color: var(--text-faint); }
	.who { display: flex; gap: 10px; align-items: center; padding: 0 4px; }
	.avatar {
		width: 32px;
		height: 32px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: var(--accent-soft);
		color: var(--accent);
		font-size: 12px;
		font-weight: 560;
		flex: none;
	}
	.meta { display: grid; min-width: 0; }
	.name { font-size: 12.5px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.meta button { display: inline-flex; align-items: center; gap: 4px; background: none; border: none; color: var(--text-faint); font-size: 11.5px; padding: 0; }
	.meta button:hover { color: var(--danger); }

	.tabbar { display: none; }

	@media (max-width: 900px) {
		.rail { display: none; }
		.tabbar {
			display: grid;
			grid-template-columns: repeat(5, 1fr);
			position: fixed;
			left: 0;
			right: 0;
			bottom: 0;
			z-index: 40;
			border-top: 1px solid var(--border);
			background: color-mix(in srgb, var(--surface-1) 88%, transparent);
			backdrop-filter: blur(14px);
			padding: 6px 4px calc(6px + env(safe-area-inset-bottom));
		}
		.tabbar a {
			display: grid;
			justify-items: center;
			gap: 2px;
			padding: 6px 2px;
			border-radius: var(--radius-xs);
			color: var(--text-muted);
			text-decoration: none;
			font-size: 10px;
			min-height: 44px;
		}
		.tabbar a.active { color: var(--accent); }
	}
</style>
