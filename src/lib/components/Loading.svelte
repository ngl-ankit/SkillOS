<script lang="ts">
	import { cx } from '$lib/utils';

	type Props = { label?: string; detail?: string; compact?: boolean };
	let { label = 'Loading', detail = '', compact = false }: Props = $props();
</script>

<div class={cx('loading', compact && 'compact')} aria-busy="true" aria-label={label}>
	<span class="spinner" aria-hidden="true"></span>
	{#if detail}<span class="detail">{detail}</span>{/if}
	{#if !compact}
		<span class="rows" aria-hidden="true">
			<span class="skeleton" style="width: 34%"></span>
			<span class="skeleton" style="width: 88%"></span>
			<span class="skeleton" style="width: 74%"></span>
			<span class="skeleton" style="width: 62%"></span>
		</span>
	{/if}
</div>

<style>
	.loading {
		display: grid;
		gap: 14px;
		justify-items: start;
		padding: clamp(20px, 4vw, 32px);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface-2);
	}
	.loading.compact {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px 16px;
	}
	.spinner {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		border: 2px solid var(--surface-4);
		border-top-color: var(--accent);
		animation: os-spin 800ms linear infinite;
	}
	.detail { color: var(--text-muted); font-size: var(--text-caption); }
	.rows { display: grid; gap: 10px; width: 100%; }
	.rows .skeleton { height: 14px; }
</style>
