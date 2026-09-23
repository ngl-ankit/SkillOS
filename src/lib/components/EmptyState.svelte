<script lang="ts">
	import { cx } from '$lib/utils';

	type Props = { title: string; detail?: string; actionLabel?: string; onAction?: () => void; compact?: boolean };
	let { title, detail = '', actionLabel = '', onAction, compact = false }: Props = $props();
</script>

<div class={cx('empty', compact && 'compact')}>
	<div class="glyph" aria-hidden="true"></div>
	<p class="title">{title}</p>
	{#if detail}<p class="detail">{detail}</p>{/if}
	{#if actionLabel && onAction}
		<button type="button" onclick={onAction}>{actionLabel}</button>
	{/if}
</div>

<style>
	.empty {
		display: grid;
		place-items: center;
		gap: 8px;
		text-align: center;
		padding: clamp(28px, 6vw, 52px) 20px;
		border: 1px dashed var(--border-strong);
		border-radius: var(--radius-lg);
		background: transparent;
	}
	.empty.compact { padding: 18px; }
	.glyph {
		width: 34px;
		height: 34px;
		border-radius: 10px;
		border: 1px solid var(--border-strong);
		background: var(--surface-3);
		box-shadow: inset 0 1px 0 rgb(255 255 255 / 5%);
		margin-bottom: 4px;
	}
	.title { margin: 0; font-weight: 540; color: var(--text); }
	.detail { margin: 0; max-width: 46ch; font-size: var(--text-caption); color: var(--text-muted); }
	button {
		margin-top: 8px;
		min-height: 38px;
		padding: 0 16px;
		border-radius: var(--radius-sm);
		border: 1px solid transparent;
		background: var(--accent);
		color: var(--accent-contrast);
		font-size: 13px;
		font-weight: 550;
	}
</style>
