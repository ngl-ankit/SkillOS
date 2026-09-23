<script lang="ts">
	
	import { createQuery } from '@tanstack/svelte-query';
	import EmptyState from '$components/EmptyState.svelte';
	import ErrorState from '$components/ErrorState.svelte';
	import Loading from '$components/Loading.svelte';
import { api } from '$lib/trpc';
	import { cx, relTime } from '$lib/utils';

	const conversations = createQuery(() => ({ queryKey: ['conversations'], queryFn: () => api.mentor.conversations.query({}) }));
	const me = createQuery(() => ({ queryKey: ['me'], queryFn: () => api.profile.me.query() }));

	let conversationId = $state<string | null>(null);
	let input = $state('');
	let pending = $state<string | null>(null);
	let sending = $state(false);

	const messages = createQuery(() => ({
		queryKey: ['messages', conversationId],
		queryFn: () => api.mentor.messages.query({ conversationId: conversationId as string }),
		enabled: Boolean(conversationId)
	}));

	async function send(event: SubmitEvent) {
		event.preventDefault();
		const text = input.trim();
		if (text.length === 0 || sending) return;
		sending = true;
		pending = text;
		input = '';
		try {
			const result = await api.mentor.ask.mutate({ conversationId, message: text });
			conversationId = result.conversationId;
			if (!result.ai) pending = null;
			await Promise.all([conversations.refetch(), messages.refetch()]);
		} finally {
			sending = false;
			pending = null;
		}
	}
</script>

<div class="wrap">
	<aside class="surface-card sidebar">
		<button class="new" type="button" onclick={() => (conversationId = null)}>New conversation</button>
		<ul>
			{#each conversations.data ?? [] as convo (convo.id)}
				<li>
					<button type="button" class:on={conversationId === convo.id} onclick={() => (conversationId = convo.id)}>
						<span class="t">{convo.title}</span>
						<span class="meta">{relTime(convo.updatedAt)}</span>
					</button>
				</li>
			{/each}
		</ul>
	</aside>

	<main class="surface-card chat">
		{#if me.data && !me.data.ai.available}
			<p class="ai-off">The AI mentor is offline — no XAI_API_KEY configured. Everything else keeps working.</p>
		{/if}

		{#if conversationId && messages.isLoading}
			<Loading compact />
		{:else if conversationId && messages.error}
			<ErrorState compact retry={() => messages.refetch()} />
		{:else if !conversationId || (messages.data && messages.data.length === 0)}
			<EmptyState
				title="Ask anything about what you're learning"
				detail="The mentor knows your goal, current topic, weak areas and preferences — ask for explanations, exercises or a plan."
			/>
		{:else if messages.data}
			<div class="thread">
				{#each messages.data as message (message.id)}
					<div class="msg {message.role}"><p>{message.content}</p></div>
				{/each}
				{#if pending}
					<div class="msg user"><p>{pending}</p></div>
					<div class="msg assistant"><p class="typing">…</p></div>
				{/if}
			</div>
		{/if}

		<form class="composer" onsubmit={send}>
			<textarea rows="2" maxlength="4000" bind:value={input} placeholder="Ask the mentor…" onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(new Event('submit') as unknown as SubmitEvent); } }}></textarea>
			<button type="submit" disabled={sending || input.trim().length === 0}>{sending ? '…' : 'Send'}</button>
		</form>
	</main>
</div>

<style>
	.wrap { display: grid; grid-template-columns: 250px minmax(0, 1fr); gap: 12px; align-items: start; }
	.sidebar { padding: 12px; display: grid; gap: 8px; }
	.new {
		min-height: 40px; border-radius: var(--radius-sm); border: 1px solid var(--border-strong);
		background: var(--surface-3); color: var(--text); font-size: 13px;
	}
	.sidebar ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; max-height: 60vh; overflow-y: auto; }
	.sidebar button {
		display: grid; gap: 2px; width: 100%; text-align: left; padding: 8px 10px; border-radius: var(--radius-xs);
		border: none; background: transparent; cursor: pointer;
	}
	.sidebar button.on { background: var(--accent-soft); }
	.sidebar .t { font-size: 12.5px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.sidebar .meta { font-size: 10.5px; color: var(--text-faint); }
	.chat { padding: 18px; display: flex; flex-direction: column; gap: 14px; min-height: 60vh; }
	.ai-off { margin: 0; padding: 10px 14px; border-radius: var(--radius-sm); background: var(--warning-soft); color: var(--warning); font-size: 13px; }
	.thread { flex: 1; display: grid; gap: 10px; align-content: start; overflow-y: auto; }
	.msg { max-width: 78ch; padding: 10px 14px; border-radius: var(--radius-md); font-size: 14px; line-height: 1.6; }
	.msg p { margin: 0; white-space: pre-wrap; }
	.msg.user { justify-self: end; background: var(--accent-soft); color: var(--text); border: 1px solid var(--accent-soft-strong); }
	.msg.assistant { justify-self: start; background: var(--surface-3); border: 1px solid var(--border); }
	.typing { color: var(--text-muted); animation: os-pulse-ring 1.2s ease-in-out infinite; }
	.composer { display: flex; gap: 10px; align-items: flex-end; }
	.composer textarea {
		flex: 1; padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-strong);
		background: var(--surface-3); color: var(--text); font-size: 14px; resize: vertical;
	}
	.composer button {
		min-height: 44px; padding: 0 18px; border: none; border-radius: var(--radius-sm);
		background: var(--accent); color: var(--accent-contrast); font-weight: 550; font-size: 14px;
	}
	.composer button:disabled { opacity: 0.5; }
	@media (max-width: 900px) {
		.wrap { grid-template-columns: minmax(0, 1fr); }
		.sidebar ul { max-height: 140px; }
	}
</style>
