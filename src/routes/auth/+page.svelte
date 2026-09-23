<script lang="ts">
		
	import { createAuthClient } from 'better-auth/client';
	import { goto } from '$app/navigation';
import { page } from '$app/state';

	const authClient = createAuthClient();
	let mode = $state<'signin' | 'signup'>('signin');
	let name = $state('');
	let email = $state('');
	let password = $state('');
	let busy = $state(false);
	let error = $state('');

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = '';
		try {
			const result =
				mode === 'signup'
					? await authClient.signUp.email({ name, email, password })
					: await authClient.signIn.email({ email, password });
			if (result.error) {
				error = result.error.message ?? 'Authentication failed.';
			} else {
				await goto('/app', { invalidateAll: true });
			}
		} catch {
			error = 'Could not reach the authentication service.';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>{mode === 'signup' ? 'Create your account' : 'Sign in'} · SkillOS</title></svelte:head>

<main class="auth">
	<div class="panel surface-card">
		<a class="brand" href="/">Skill<span>OS</span></a>
		<h1>{mode === 'signup' ? 'Start your learning OS' : 'Welcome back'}</h1>
		<p class="sub">{mode === 'signup' ? 'One account, your whole roadmap, plan and mentor.' : 'Your plan picked up where you left it.'}</p>

		<form onsubmit={submit}>
			{#if mode === 'signup'}
				<label>
					<span>Name</span>
					<input type="text" bind:value={name} required minlength="1" maxlength="80" autocomplete="name" placeholder="Ada" />
				</label>
			{/if}
			<label>
				<span>Email</span>
				<input type="email" bind:value={email} required autocomplete="email" placeholder="you@example.com" />
			</label>
			<label>
				<span>Password</span>
				<input type="password" bind:value={password} required minlength="8" maxlength="128" autocomplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder="At least 8 characters" />
			</label>

			{#if error}<p class="error" role="alert">{error}</p>{/if}

			<button class="cta" type="submit" disabled={busy}>{busy ? 'Working…' : mode === 'signup' ? 'Create account' : 'Sign in'}</button>
		</form>

		<button class="switch" type="button" onclick={() => (mode = mode === 'signup' ? 'signin' : 'signup')}>
			{mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}
		</button>
	</div>
</main>

<style>
	.auth {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: 20px;
		background:
			radial-gradient(60% 50% at 50% 0%, var(--accent-soft) 0%, transparent 70%),
			var(--bg);
	}
	.panel { width: min(420px, 100%); padding: clamp(24px, 5vw, 40px); display: grid; gap: 16px; }
	.brand { font-weight: 620; letter-spacing: -0.03em; font-size: 18px; color: var(--text); text-decoration: none; }
	.brand span { color: var(--accent); }
	h1 { margin: 0; font-size: 24px; }
	.sub { margin: -6px 0 0; color: var(--text-muted); font-size: var(--text-caption); }
	form { display: grid; gap: 14px; }
	label { display: grid; gap: 6px; font-size: 13px; color: var(--text-secondary); }
	input {
		min-height: 44px;
		padding: 0 14px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-strong);
		background: var(--surface-3);
		color: var(--text);
		font-size: 14px;
	}
	input:focus { border-color: var(--accent); outline: none; box-shadow: 0 0 0 3px var(--accent-soft); }
	.error { margin: 0; color: var(--danger); font-size: 13px; }
	.cta {
		min-height: 46px;
		border: none;
		border-radius: var(--radius-sm);
		background: var(--accent);
		color: var(--accent-contrast);
		font-weight: 560;
		font-size: 14px;
	}
	.cta:disabled { opacity: 0.6; }
	.switch { background: none; border: none; color: var(--text-muted); font-size: 13px; text-decoration: underline; text-underline-offset: 3px; }
</style>
