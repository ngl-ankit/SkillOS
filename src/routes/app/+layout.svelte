<script lang="ts">
	
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import { createAuthClient } from 'better-auth/client';
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
import { page } from '$app/state';
	import AppNav from '$components/AppNav.svelte';
	import CommandPalette from '$components/CommandPalette.svelte';

	const authClient = createAuthClient();

	let { data, children }: { data: { user: { id: string; name: string; email: string } }; children: Snippet } = $props();

	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false } }
	});

	let paletteOpen = $state(false);

	function onKeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			paletteOpen = !paletteOpen;
		}
	}

	async function signOut() {
		await authClient.signOut();
		await goto('/', { invalidateAll: true });
	}
</script>

<svelte:head><meta name="theme-color" content="#0a0b0d" /></svelte:head>
<svelte:window onkeydown={onKeydown} />

<QueryClientProvider client={queryClient}>
	<div class="shell">
		<AppNav user={data.user} path={page.url.pathname} onSignOut={signOut} />
		<main class="content">
			{@render children()}
		</main>
	</div>
	<CommandPalette bind:open={paletteOpen} />
</QueryClientProvider>

<style>
	.shell {
		display: grid;
		grid-template-columns: 240px minmax(0, 1fr);
		min-height: 100dvh;
	}
	.content {
		padding: clamp(16px, 3vw, 36px);
		max-width: 1200px;
		width: 100%;
		margin: 0 auto;
		min-width: 0;
	}

	@media (max-width: 900px) {
		.shell { grid-template-columns: minmax(0, 1fr); }
		.content { padding: 16px 16px calc(76px + env(safe-area-inset-bottom)); }
	}
</style>
