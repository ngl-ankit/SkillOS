<script lang="ts">
	
	import { createQuery } from '@tanstack/svelte-query';
	import ErrorState from '$components/ErrorState.svelte';
	import Loading from '$components/Loading.svelte';
import { api } from '$lib/trpc';
	import { humanMinutes } from '$lib/utils';

	const overview = createQuery(() => ({ queryKey: ['settings'], queryFn: () => api.settings.overview.query() }));

	let saving = $state(false);
	let savedAt = $state('');

	async function savePref(patch: Record<string, unknown>) {
		saving = true;
		try {
			await api.settings.updatePreferences.mutate(patch);
			await overview.refetch();
			savedAt = new Date().toLocaleTimeString();
		} finally {
			saving = false;
		}
	}

	async function saveProfile(patch: Record<string, unknown>) {
		saving = true;
		try {
			await api.settings.updateProfile.mutate(patch);
			await overview.refetch();
			savedAt = new Date().toLocaleTimeString();
		} finally {
			saving = false;
		}
	}

	async function exportData() {
		const data = await api.settings.exportData.query();
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `skillos-export-${new Date().toISOString().slice(0, 10)}.json`;
		link.click();
		URL.revokeObjectURL(url);
	}

	async function clearCache() {
		await api.settings.clearCache.mutate();
		await overview.refetch();
	}

	async function resetLearning() {
		if (!confirm('Delete all learning data? Your account and sign-in remain.')) return;
		await api.settings.resetLearningData.mutate();
		location.assign('/app/onboarding');
	}
</script>

<h1>Settings</h1>

{#if overview.isLoading}
	<Loading />
{:else if overview.error}
	<ErrorState retry={() => overview.refetch()} />
{:else if overview.data}
	{#if savedAt}<p class="saved">Saved at {savedAt}{saving ? ' · saving…' : ''}</p>{/if}

	<section class="surface-card">
		<h3>Profile</h3>
		<div class="fields">
			<label><span>Name</span><input type="text" maxlength="80" value={overview.data.profile?.displayName ?? ''} onchange={(e) => saveProfile({ displayName: e.currentTarget.value })} /></label>
			<label>
				<span>Level</span>
				<select value={overview.data.profile?.level ?? 'beginner'} onchange={(e) => saveProfile({ level: e.currentTarget.value })}>
					<option value="beginner">Beginner</option>
					<option value="intermediate">Intermediate</option>
					<option value="advanced">Advanced</option>
				</select>
			</label>
			<label><span>Daily minutes</span><input type="number" min="10" max="600" value={overview.data.profile?.dailyMinutes ?? 60} onchange={(e) => saveProfile({ dailyMinutes: Number(e.currentTarget.value) })} /></label>
			<label><span>Timezone</span><input type="text" maxlength="64" value={overview.data.profile?.timezone ?? 'UTC'} onchange={(e) => saveProfile({ timezone: e.currentTarget.value })} /></label>
		</div>
	</section>

	<section class="surface-card">
		<h3>Experience</h3>
		<div class="fields">
			<label>
				<span>Universe mode</span>
				<select value={overview.data.preferences?.universeMode ?? 'auto'} onchange={(e) => savePref({ universeMode: e.currentTarget.value })}>
					<option value="auto">Auto</option>
					<option value="3d">3D</option>
					<option value="2d">2D</option>
				</select>
			</label>
			<label>
				<span>Mentor answers</span>
				<select value={overview.data.preferences?.mentorAnswerStyle ?? 'guided'} onchange={(e) => savePref({ mentorAnswerStyle: e.currentTarget.value })}>
					<option value="guided">Guided</option>
					<option value="direct">Direct</option>
				</select>
			</label>
			<label><span>Reminder hour (0–23)</span><input type="number" min="0" max="23" value={overview.data.preferences?.reminderHour ?? 18} onchange={(e) => savePref({ reminderHour: Number(e.currentTarget.value) })} /></label>
			<label><span>Plan intensity ({overview.data.preferences?.intensity ?? 100}%)</span><input type="range" min="50" max="150" value={overview.data.preferences?.intensity ?? 100} onchange={(e) => savePref({ intensity: Number(e.currentTarget.value) })} /></label>
		</div>
		<label class="toggle"><input type="checkbox" checked={overview.data.preferences?.reducedMotion ?? false} onchange={(e) => savePref({ reducedMotion: e.currentTarget.checked })} /> Reduced motion</label>
		<label class="toggle"><input type="checkbox" checked={overview.data.preferences?.notificationsEnabled ?? true} onchange={(e) => savePref({ notificationsEnabled: e.currentTarget.checked })} /> Notifications</label>
	</section>

	<section class="surface-card">
		<h3>Usage</h3>
		<p class="meta">{overview.data.stats.minutesTotal} min total · {overview.data.stats.topicCompletion.completed}/{overview.data.stats.topicCompletion.total} topics · {overview.data.stats.notesCount} notes · {overview.data.stats.projectsCompleted} projects</p>
		<p class="meta">AI cache: {overview.data.cache.entries} entries · current streak {overview.data.streak.current}d (best {overview.data.streak.longest}d)</p>
	</section>

	<section class="surface-card danger-zone">
		<h3>Data</h3>
		<div class="row">
			<button type="button" onclick={exportData}>Export all my data (JSON)</button>
			<button type="button" onclick={clearCache}>Clear AI cache</button>
			<button type="button" class="danger" onclick={resetLearning}>Reset learning data</button>
		</div>
	</section>
{/if}

<style>
	h1 { margin: 0 0 16px; }
	.saved { color: var(--success); font-size: 12.5px; }
	section { padding: 20px; max-width: 720px; margin-bottom: 14px; display: grid; gap: 10px; }
	h3 { margin: 0; font-size: 14px; color: var(--text-secondary); }
	.fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
	label { display: grid; gap: 6px; font-size: 12.5px; color: var(--text-muted); }
	input, select {
		min-height: 42px; padding: 0 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-strong);
		background: var(--surface-3); color: var(--text); font-size: 14px;
	}
	input[type='range'] { padding: 0; }
	.toggle { display: flex; gap: 8px; align-items: center; font-size: 13.5px; color: var(--text-secondary); }
	.toggle input { accent-color: var(--accent); }
	.meta { margin: 0; color: var(--text-muted); font-size: 13px; }
	.row { display: flex; gap: 10px; flex-wrap: wrap; }
	.row button {
		min-height: 40px; padding: 0 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-strong);
		background: var(--surface-3); color: var(--text); font-size: 13px;
	}
	.row button.danger { color: var(--danger); border-color: var(--danger); }
</style>
