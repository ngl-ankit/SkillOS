<script lang="ts">
	import { cx } from '$lib/utils';

	type Props = {
		items: { label: string; value: string; hint?: string }[];
	};
	let { items }: Props = $props();
</script>

<div class="stats">
	{#each items as item (item.label)}
		<div class="stat surface-card">
			<span class="value">{item.value}</span>
			<span class="label">{item.label}</span>
			{#if item.hint}<span class="hint">{item.hint}</span>{/if}
		</div>
	{/each}
</div>

<style>
	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
		gap: 10px;
	}
	.stat {
		display: grid;
		gap: 2px;
		padding: 14px 16px;
	}
	.value {
		font-size: 22px;
		font-weight: 560;
		letter-spacing: -0.02em;
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}
	.label { font-size: 12px; color: var(--text-muted); }
	.hint { font-size: 11px; color: var(--text-faint); }
</style>
