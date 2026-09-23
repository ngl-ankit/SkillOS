<script lang="ts">
	
	import { createQuery } from '@tanstack/svelte-query';
	import { goto } from '$app/navigation';
	import ErrorState from '$components/ErrorState.svelte';
	import Loading from '$components/Loading.svelte';
import { api } from '$lib/trpc';
	import { todayISO } from '$lib/utils';

	const steps = ['Name', 'Interest', 'Level', 'Skills', 'Time', 'Style', 'Career', 'Deadline'] as const;
	let step = $state(0);
	let displayName = $state('');
	let goalTitle = $state('');
	let trackSlug = $state<string | null>(null);
	let level = $state<'beginner' | 'intermediate' | 'advanced'>('beginner');
	let skillsInput = $state('');
	let dailyMinutes = $state(60);
	let learningStyle = $state<'reading' | 'video' | 'hands_on' | 'mixed'>('mixed');
	let targetRole = $state('');
	let deadline = $state('');
	let motivation = $state('');
	let saving = $state(false);
	let error = $state('');

	const tracksQuery = createQuery(() => ({ queryKey: ['tracks'], queryFn: () => api.onboarding.tracks.query() }));
	const suggestQuery = createQuery(() => ({
		queryKey: ['suggest', goalTitle],
		queryFn: () => api.onboarding.suggest.query({ goal: goalTitle, skills: skillsInput.split(',').map((s) => s.trim()).filter(Boolean) }),
		enabled: goalTitle.trim().length >= 2
	}));

	async function finish() {
		saving = true;
		error = '';
		try {
			await api.onboarding.complete.mutate({
				displayName: displayName.trim() || 'Learner',
				goalTitle: goalTitle.trim(),
				level,
				existingSkills: skillsInput.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 40),
				dailyMinutes,
				learningStyle,
				targetRole: targetRole.trim() || null,
				deadline: deadline || null,
				motivation: motivation.trim() || null,
				trackSlug,
				timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
				today: todayISO()
			});
			await goto('/app', { invalidateAll: true });
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not finish onboarding.';
		} finally {
			saving = false;
		}
	}

	function canAdvance(): boolean {
		if (step === 0) return displayName.trim().length > 0;
		if (step === 1) return goalTitle.trim().length >= 3;
		return true;
	}
</script>

<div class="wrap">
	<div class="progress" aria-label="Onboarding progress">
		{#each steps as label, index (label)}
			<span class:on={index <= step} title={label}></span>
		{/each}
	</div>
	<p class="count">Step {step + 1} of {steps.length} — {steps[step]}</p>

	<article class="surface-card step">
		{#if step === 0}
			<h1>What should we call you?</h1>
			<input class="big" type="text" bind:value={displayName} maxlength="80" placeholder="Your name" />
		{:else if step === 1}
			<h1>What do you want to learn?</h1>
			<input class="big" type="text" bind:value={goalTitle} maxlength="200" placeholder="e.g. Become a backend engineer" />
			{#if suggestQuery.data && suggestQuery.data.length > 0}
				<p class="hint">Matching tracks:</p>
				<div class="chips">
					{#each suggestQuery.data as suggestion (suggestion.slug)}
						<button type="button" class="chip" class:on={trackSlug === suggestion.slug} onclick={() => (trackSlug = suggestion.slug)}>
							{suggestion.title} · {suggestion.match}% match
						</button>
					{/each}
				</div>
			{/if}
		{:else if step === 2}
			<h1>Where are you starting from?</h1>
			<div class="chips">
				{#each [['beginner', 'New to this'], ['intermediate', 'Comfortable with basics'], ['advanced', 'Experienced, going deeper']] as [value, label] (value)}
					<button type="button" class="chip" class:on={level === value} onclick={() => (level = value as typeof level)}>{label}</button>
				{/each}
			</div>
		{:else if step === 3}
			<h1>What do you already know?</h1>
			<p class="hint">Comma-separated. Topics you already master get skipped.</p>
			<textarea rows="3" bind:value={skillsInput} placeholder="e.g. HTML, CSS, basic SQL"></textarea>
		{:else if step === 4}
			<h1>How much time per day?</h1>
			<p class="hint">{dailyMinutes} minutes</p>
			<input type="range" min="10" max="300" step="5" bind:value={dailyMinutes} />
		{:else if step === 5}
			<h1>How do you learn best?</h1>
			<div class="chips">
				{#each [['reading', 'Reading'], ['video', 'Video'], ['hands_on', 'Hands-on'], ['mixed', 'A mix']] as [value, label] (value)}
					<button type="button" class="chip" class:on={learningStyle === value} onclick={() => (learningStyle = value as typeof learningStyle)}>{label}</button>
				{/each}
			</div>
		{:else if step === 6}
			<h1>Where is this headed?</h1>
			<input class="big" type="text" bind:value={targetRole} maxlength="120" placeholder="Target role (optional — e.g. data analyst)" />
			<textarea rows="2" maxlength="400" bind:value={motivation} placeholder="Why does this matter to you? (optional)"></textarea>
		{:else}
			<h1>Any deadline?</h1>
			<input class="big" type="date" bind:value={deadline} />
			<p class="hint">Optional — plans get denser as it approaches.</p>
			{#if error}<p class="error" role="alert">{error}</p>{/if}
		{/if}
	</article>

	<div class="nav">
		{#if step > 0}
			<button type="button" class="ghost" onclick={() => (step -= 1)}>Back</button>
		{/if}
		{#if step < steps.length - 1}
			<button type="button" disabled={!canAdvance()} onclick={() => (step += 1)}>Continue</button>
		{:else}
			<button type="button" disabled={saving} onclick={finish}>{saving ? 'Building your roadmap…' : 'Build my roadmap'}</button>
		{/if}
	</div>
</div>

<style>
	.wrap { max-width: 560px; margin: 0 auto; padding-top: 4vh; }
	.progress { display: flex; gap: 6px; }
	.progress span { flex: 1; height: 4px; border-radius: 99px; background: var(--surface-4); }
	.progress span.on { background: var(--accent); }
	.count { margin: 10px 0 14px; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); }
	.step { padding: clamp(22px, 5vw, 36px); animation: os-fade-up var(--dur-slow) var(--ease-out) both; min-height: 260px; }
	h1 { margin: 0 0 18px; font-size: clamp(20px, 4vw, 28px); }
	.big {
		width: 100%; min-height: 48px; padding: 0 14px; border-radius: var(--radius-sm);
		border: 1px solid var(--border-strong); background: var(--surface-3); color: var(--text); font-size: 16px;
	}
	textarea, input[type='date'] {
		width: 100%; min-height: 46px; padding: 10px 14px; border-radius: var(--radius-sm);
		border: 1px solid var(--border-strong); background: var(--surface-3); color: var(--text); font-size: 14px; resize: vertical;
	}
	.hint { color: var(--text-muted); font-size: 13px; margin: 12px 0 8px; }
	.chips { display: flex; flex-wrap: wrap; gap: 8px; }
	.chip {
		min-height: 40px; padding: 0 16px; border-radius: 99px; border: 1px solid var(--border-strong);
		background: var(--surface-3); color: var(--text-secondary); font-size: 13.5px; cursor: pointer;
	}
	.chip.on { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
	input[type='range'] { width: 100%; accent-color: var(--accent); }
	.error { color: var(--danger); font-size: 13px; }
	.nav { display: flex; justify-content: space-between; gap: 10px; margin-top: 16px; }
	.nav button {
		min-height: 46px; padding: 0 22px; border-radius: var(--radius-sm); border: none;
		background: var(--accent); color: var(--accent-contrast); font-weight: 560; font-size: 14px;
	}
	.nav button.ghost { background: transparent; border: 1px solid var(--border-strong); color: var(--text-muted); }
	.nav button:disabled { opacity: 0.5; }
</style>
