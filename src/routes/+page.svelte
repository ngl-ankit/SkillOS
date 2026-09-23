<script lang="ts">
	import { goto } from '$app/navigation';

	const features = [
		{ title: 'A plan, every morning', detail: 'Time-boxed blocks for learning, practice and revision — fitted to the minutes you actually have.' },
		{ title: 'A roadmap that thinks', detail: 'Goal → phases → topics → practice → project → assessment, with prerequisites unlocked in order.' },
		{ title: 'A mentor with memory', detail: 'Grok-powered tutoring grounded in your real progress, weak spots and preferences.' },
		{ title: 'Nothing escapes revision', detail: 'Spaced repetition resurfaces exactly what is about to decay.' }
	];

	function start() {
		goto('/auth').then(() => {});
	}
</script>

<svelte:head>
	<title>SkillOS — your personal learning OS</title>
	<meta name="description" content="SkillOS turns a learning goal into a daily executable plan: roadmap, sessions, practice, projects, spaced revision and an AI mentor with memory." />
</svelte:head>

<div class="hero grid-noise">
	<nav class="nav">
		<span class="brand">Skill<span>OS</span></span>
		<a class="nav-cta" href="/auth">Open the OS</a>
	</nav>

	<main>
		<p class="kicker">Personal learning operating system</p>
		<h1 class="display">Stop collecting resources.<br />Start executing a plan.</h1>
		<p class="lead">
			SkillOS takes one goal, builds the roadmap, decides what you should do today, checks your understanding, schedules
			the reviews you will forget — and gives you a mentor that remembers all of it.
		</p>
		<div class="cta-row">
			<a class="primary" href="/auth">Get started</a>
			<a class="ghost" href="/auth">I already have an account</a>
		</div>

		<section class="features">
			{#each features as feature (feature.title)}
				<article class="surface-card">
					<h3>{feature.title}</h3>
					<p>{feature.detail}</p>
				</article>
			{/each}
		</section>
	</main>

	<footer>
		<span>Built with SvelteKit, Drizzle, Better Auth and Grok.</span>
		<a href="/api/health">Status</a>
	</footer>
</div>

<style>
	.hero {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		padding: clamp(16px, 4vw, 40px);
		max-width: 1080px;
		margin: 0 auto;
	}
	.nav { display: flex; align-items: center; justify-content: space-between; }
	.brand { font-weight: 620; letter-spacing: -0.03em; font-size: 20px; }
	.brand span { color: var(--accent); }
	.nav-cta {
		display: inline-flex;
		align-items: center;
		min-height: 40px;
		padding: 0 16px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-strong);
		color: var(--text);
		text-decoration: none;
		font-size: 14px;
	}
	main { flex: 1; display: grid; place-content: center; gap: 22px; padding: 8vh 0; }
	.kicker { margin: 0; font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); }
	.display { margin: 0; font-size: clamp(34px, 7vw, 62px); font-weight: 600; letter-spacing: -0.035em; line-height: 1.04; }
	.lead { margin: 0; max-width: 58ch; color: var(--text-secondary); font-size: clamp(15px, 2vw, 17px); }
	.cta-row { display: flex; flex-wrap: wrap; gap: 12px; }
	.cta-row a {
		display: inline-flex;
		align-items: center;
		min-height: 46px;
		padding: 0 22px;
		border-radius: var(--radius-sm);
		text-decoration: none;
		font-weight: 550;
		font-size: 14px;
	}
	.primary { background: var(--accent); color: var(--accent-contrast); }
	.ghost { border: 1px solid var(--border-strong); color: var(--text); }
	.features { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-top: 4vh; }
	.features article { padding: 18px; }
	.features h3 { margin: 0 0 6px; font-size: 15px; }
	.features p { margin: 0; font-size: 13.5px; color: var(--text-muted); }
	footer { display: flex; justify-content: space-between; gap: 12px; color: var(--text-faint); font-size: 12px; }
	footer a { color: inherit; }
</style>
