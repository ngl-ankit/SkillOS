<script lang="ts">
	
	import { createQuery } from '@tanstack/svelte-query';
	import EmptyState from '$components/EmptyState.svelte';
	import ErrorState from '$components/ErrorState.svelte';
	import Loading from '$components/Loading.svelte';
import { api } from '$lib/trpc';
	import { todayISO } from '$lib/utils';

	const day = todayISO();
	const checkQ = createQuery(() => ({ queryKey: ['checkin', day], queryFn: () => api.checkIn.today.query({ day }) }));

	let completedPlan = $state<'yes' | 'partly' | 'no'>('yes');
	let minutesStudied = $state(0);
	let difficulty = $state(3);
	let confidence = $state(3);
	let tomorrow = $state<'lighter' | 'similar' | 'harder'>('similar');
	let blockers = $state<string[]>([]);
	let blockerNote = $state('');
	let topicsCovered = $state<string[]>([]);
	let saving = $state(false);
	let done = $state(false);
	let adaptation = $state('');
	let init = $state(false);

	$effect(() => {
		if (checkQ.data && !init) {
			init = true;
			minutesStudied = checkQ.data.minutesLogged;
			done = Boolean(checkQ.data.existing);
		}
	});

	const blockerOptions = ['time', 'confusion', 'motivation', 'environment', 'illness', 'work', 'other'];

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		saving = true;
		try {
			const result = await api.plan.checkIn.mutate({
				day,
				completedPlan,
				minutesStudied,
				difficulty,
				confidence,
				blockers: blockers as ('time' | 'confusion' | 'motivation' | 'environment' | 'illness' | 'work' | 'other')[],
				blockerNote: blockerNote.trim() || null,
				tomorrow,
				topicsCovered
			});
			adaptation = result.adaptation;
			done = true;
			await checkQ.refetch();
		} finally {
			saving = false;
		}
	}
</script>

<h1>Daily check-in</h1>
<p class="meta">Two minutes. This is what adapts tomorrow's plan.</p>

{#if checkQ.isLoading}
	<Loading compact />
{:else if checkQ.error}
	<ErrorState retry={() => checkQ.refetch()} />
{:else if checkQ.data?.existing && done}
	<section class="surface-card done-card">
		<h2>Checked in ✓</h2>
		<p class="meta">Your check-in for {day} is recorded.</p>
		{#if adaptation}<p class="adapt">{adaptation}</p>{/if}
		<p class="meta">Streak of check-ins: {checkQ.data.streakOfCheckIns} day(s) · {checkQ.data.itemsDone}/{checkQ.data.itemsTotal} plan items done · {checkQ.data.minutesLogged} min logged.</p>
	</section>
{:else if checkQ.data}
	<form class="surface-card form" onsubmit={submit}>
		<p class="q">Did you complete today's plan?</p>
		<div class="row" role="radiogroup" aria-label="Plan completion">
			{#each ['yes', 'partly', 'no'] as option (option)}
				<label class="chip" class:on={completedPlan === option}>
					<input type="radio" name="completed" value={option} bind:group={completedPlan} /> {option === 'yes' ? 'Fully' : option === 'partly' ? 'Partly' : 'No'}
				</label>
			{/each}
		</div>

		<p class="q">Minutes studied today</p>
		<input type="number" min="0" max="720" bind:value={minutesStudied} />

		<p class="q">How hard was it?</p>
		<input type="range" min="1" max="5" bind:value={difficulty} />
		<p class="scale">{['', 'Too easy', 'Manageable', 'Challenging', 'Hard', 'Overwhelming'][difficulty]}</p>

		<p class="q">How confident do you feel about the material?</p>
		<input type="range" min="1" max="5" bind:value={confidence} />
		<p class="scale">{['', 'Lost', 'Shaky', 'Getting there', 'Solid', 'Could teach it'][confidence]}</p>

		<p class="q">What got in the way?</p>
		<div class="row">
			{#each blockerOptions as option (option)}
				<label class="chip" class:on={blockers.includes(option)}>
					<input type="checkbox" value={option} checked={blockers.includes(option)} onchange={(e) => (blockers = e.currentTarget.checked ? [...blockers, option] : blockers.filter((b) => b !== option))} />
					{option}
				</label>
			{/each}
		</div>
		<textarea rows="2" maxlength="600" placeholder="Optional note (what exactly blocked you)" bind:value={blockerNote}></textarea>

		<p class="q">Topics you touched today</p>
		{#if checkQ.data.candidates.length > 0}
			<div class="row">
				{#each checkQ.data.candidates as candidate (candidate.topicId)}
					<label class="chip" class:on={topicsCovered.includes(candidate.topicId)}>
						<input
							type="checkbox"
							checked={topicsCovered.includes(candidate.topicId)}
							onchange={(e) => (topicsCovered = e.currentTarget.checked ? [...topicsCovered, candidate.topicId] : topicsCovered.filter((t) => t !== candidate.topicId))}
						/>
						{candidate.title}
					</label>
				{/each}
			</div>
		{:else}
			<p class="meta">Nothing planned today to attach.</p>
		{/if}

		<p class="q">Tomorrow should be…</p>
		<div class="row" role="radiogroup" aria-label="Tomorrow">
			{#each ['lighter', 'similar', 'harder'] as option (option)}
				<label class="chip" class:on={tomorrow === option}>
					<input type="radio" name="tomorrow" value={option} bind:group={tomorrow} /> {option}
				</label>
			{/each}
		</div>

		<button class="cta" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Submit check-in'}</button>
	</form>
{:else}
	<EmptyState title="Nothing to check in yet" detail="A plan appears here once your roadmap exists." />
{/if}

<style>
	h1 { margin: 0 0 4px; }
	.meta { color: var(--text-muted); font-size: 13px; }
	.form { margin-top: 16px; padding: 22px; display: grid; gap: 10px; max-width: 640px; }
	.q { margin: 8px 0 2px; font-size: 14px; font-weight: 540; }
	.row { display: flex; flex-wrap: wrap; gap: 8px; }
	.chip {
		display: inline-flex; align-items: center; gap: 6px; min-height: 38px; padding: 0 14px;
		border-radius: 99px; border: 1px solid var(--border-strong); font-size: 13px; cursor: pointer; background: var(--surface-3);
	}
	.chip.on { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
	.chip input { accent-color: var(--accent); }
	input[type='number'], textarea {
		min-height: 42px; padding: 8px 12px; border-radius: var(--radius-sm);
		border: 1px solid var(--border-strong); background: var(--surface-3); color: var(--text); font-size: 14px; max-width: 160px;
	}
	textarea { max-width: none; min-height: 60px; resize: vertical; }
	input[type='range'] { width: min(320px, 100%); accent-color: var(--accent); }
	.scale { margin: 0; font-size: 12px; color: var(--text-muted); }
	.cta {
		margin-top: 10px; min-height: 46px; border: none; border-radius: var(--radius-sm);
		background: var(--accent); color: var(--accent-contrast); font-weight: 560; font-size: 14px;
	}
	.done-card { margin-top: 16px; padding: 24px; max-width: 640px; }
	.done-card h2 { margin: 0 0 6px; }
	.adapt { color: var(--text-secondary); font-size: 14px; }
</style>
