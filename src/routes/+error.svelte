<script lang="ts">
	
	import { goto } from '$app/navigation';
import { page } from '$app/state';

	const status = $derived(page.status);
	const isNotFound = $derived(status === 404);

	const heading = $derived(isNotFound ? 'Page not found' : 'Something went wrong');
	const detail = $derived(
		isNotFound
			? 'That route does not exist. It may have moved, or the link may be out of date.'
			: (page.error?.message ?? 'An unexpected error occurred. Your progress is safe.')
	);
</script>

<svelte:head><title>{heading} · SkillOS</title></svelte:head>

<div class="error-shell">
	<div class="error-card">
		<p class="code">{status}</p>
		<h1>{heading}</h1>
		<p class="detail">{detail}</p>
		<div class="actions">
			<button class="btn primary" type="button" onclick={() => location.reload()}>Try again</button>
			<a class="btn" href="/app">Back to dashboard</a>
			<a class="btn ghost" href="/">Home</a>
		</div>
		{#if page.error?.code}
			<p class="trace">Reference: {page.error.code}</p>
		{/if}
	</div>
</div>

<style>
	.error-shell {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: var(--space-6, 24px);
		background: var(--bg);
	}
	.error-card {
		width: min(560px, 100%);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg, 16px);
		padding: clamp(24px, 5vw, 40px);
		box-shadow: var(--shadow-lg);
	}
	.code {
		font-family: var(--font-mono);
		font-size: 12px;
		letter-spacing: 0.08em;
		color: var(--text-muted);
		margin: 0 0 12px;
	}
	h1 {
		font-size: clamp(24px, 4vw, 32px);
		letter-spacing: -0.02em;
		margin: 0 0 10px;
		color: var(--text);
	}
	.detail {
		color: var(--text-secondary);
		margin: 0 0 24px;
		line-height: 1.6;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	.btn {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding: 0 18px;
		border-radius: var(--radius-sm, 8px);
		border: 1px solid var(--border-strong);
		background: var(--surface-3);
		color: var(--text);
		font-size: 14px;
		font-weight: 500;
		text-decoration: none;
		cursor: pointer;
	}
	.btn.primary {
		background: var(--accent);
		border-color: transparent;
		color: var(--accent-contrast);
	}
	.btn.ghost {
		background: transparent;
	}
	.trace {
		margin: 20px 0 0;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--text-faint);
	}
</style>
