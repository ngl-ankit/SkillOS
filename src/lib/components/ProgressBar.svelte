<script lang="ts">
	import { cx, pct } from '$lib/utils';

	type Props = { value: number; max?: number; size?: 'sm' | 'md'; tone?: 'accent' | 'success' | 'warning' };
	let { value, max = 100, size = 'md', tone = 'accent' }: Props = $props();
</script>

<div class={cx('bar', size, tone)} role="progressbar" aria-valuenow={pct(value, max)} aria-valuemin="0" aria-valuemax="100">
	<span style="width: {pct(value, max)}%"></span>
</div>

<style>
	.bar {
		width: 100%;
		border-radius: 99px;
		background: var(--surface-4);
		overflow: hidden;
	}
	.bar.md { height: 8px; }
	.bar.sm { height: 5px; }
	.bar span {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--accent);
		transition: width var(--dur-slow) var(--ease-out);
	}
	.bar.success span { background: var(--success); }
	.bar.warning span { background: var(--warning); }
</style>
