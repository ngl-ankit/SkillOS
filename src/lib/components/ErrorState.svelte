<script lang="ts">
	import { cx } from '$lib/utils';

	type Props = { title?: string; detail?: string; retry?: () => void; compact?: boolean };
	let { title = 'Something went wrong', detail = 'We could not load this. Your data is safe.', retry, compact = false }: Props = $props();
</script>

<div class={cx('state', compact && 'compact')} role="alert">
	<div class="icon" aria-hidden="true">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" d="M12 9v4m0 3.5v.01M10.3 4.2 3.6 16a1.7 1.7 0 0 0 1.5 2.6h13.8a1.7 1.7 0 0 0 1.5-2.6L13.7 4.2a1.7 1.7 0 0 0-3 0Z" /></svg>
	</div>
	<p class="title">{title}</p>
	<p class="detail">{detail}</p>
	{#if retry}
		<button class="retry" type="button" onclick={retry}>Try again</button>
	{/if}
</div>

<style>
	.state {
		display: grid;
		place-items: center;
		gap: 10px;
		text-align: center;
		padding: clamp(28px, 6vw, 56px) 20px;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface-2);
	}
	.state.compact { padding: 18px; }
	.icon {
		width: 40px;
		height: 40px;
		display: grid;
		place-items: center;
		border-radius: 12px;
		background: var(--danger-soft);
		color: var(--danger);
	}
	.icon svg { width: 22px; height: 22px; }
	.title { margin: 0; font-weight: 550; color: var(--text); }
	.detail { margin: 0; max-width: 46ch; font-size: var(--text-caption); color: var(--text-muted); }
	.retry {
		margin-top: 4px;
		min-height: 38px;
		padding: 0 16px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-strong);
		background: var(--surface-3);
		color: var(--text);
		font-size: 13px;
		font-weight: 500;
	}
	.retry:hover { background: var(--surface-4); }
</style>
