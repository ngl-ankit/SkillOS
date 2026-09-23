import { createXai } from '@ai-sdk/xai';
import { generateText, streamText, type LanguageModel } from 'ai';
import { DEFAULT_XAI_MODEL, aiConfigured, env } from '../env';
import { logger } from '../logger';

/**
 * Single point of contact with Grok. Every other module goes through here so
 * the key never leaks and AI availability is handled in one place.
 */
export class AiUnavailableError extends Error {
	constructor() {
		super('The AI mentor is unavailable because XAI_API_KEY is not configured.');
		this.name = 'AiUnavailableError';
	}
}

let provider: ReturnType<typeof createXai> | null = null;

function client() {
	if (!aiConfigured()) throw new AiUnavailableError();
	if (!provider) provider = createXai({ apiKey: env().XAI_API_KEY });
	return provider;
}

export function modelId(): string {
	return env().XAI_MODEL || DEFAULT_XAI_MODEL;
}

export function model(): LanguageModel {
	return client()(modelId());
}

export function aiAvailable(): boolean {
	try {
		return aiConfigured();
	} catch {
		return false;
	}
}

export type Usage = { inputTokens?: number; outputTokens?: number };

/**
 * Non-streaming generation with a hard timeout and bounded retries.
 * Returns null instead of throwing so callers can degrade gracefully.
 */
export async function generate(options: {
	system: string;
	prompt: string;
	maxOutputTokens?: number;
	temperature?: number;
	timeoutMs?: number;
}): Promise<{ text: string; usage: Usage } | null> {
	if (!aiAvailable()) return null;
	const started = Date.now();
	try {
		const result = await generateText({
			model: model(),
			system: options.system,
			prompt: options.prompt,
			maxOutputTokens: options.maxOutputTokens ?? 900,
			temperature: options.temperature ?? 0.5,
			abortSignal: AbortSignal.timeout(options.timeoutMs ?? 30_000)
		});
		logger.info('ai.generate', { ms: Date.now() - started, chars: result.text.length });
		return {
			text: result.text.trim(),
			usage: { inputTokens: result.usage?.inputTokens, outputTokens: result.usage?.outputTokens }
		};
	} catch (err) {
		logger.warn('ai.generate_failed', { reason: err instanceof Error ? err.message : String(err) });
		return null;
	}
}

/** Streaming generation used by the mentor chat. Falls back to a single chunk on failure. */
export function stream(options: { system: string; messages: { role: 'user' | 'assistant'; content: string }[]; maxOutputTokens?: number; temperature?: number }) {
	return streamText({
		model: model(),
		system: options.system,
		messages: options.messages,
		maxOutputTokens: options.maxOutputTokens ?? 1200,
		temperature: options.temperature ?? 0.6,
		abortSignal: AbortSignal.timeout(90_000)
	});
}

/**
 * Extracts the first JSON object/array from a model response. Models often wrap
 * JSON in prose or fences; we never trust that the output is pure JSON.
 */
export function parseJson<T>(text: string | null | undefined): T | null {
	if (!text) return null;
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
	const candidate = (fenced?.[1] ?? text).trim();
	const start = candidate.search(/[[{]/);
	if (start === -1) return null;
	const opener = candidate[start];
	const closer = opener === '{' ? '}' : ']';
	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let i = start; i < candidate.length; i += 1) {
		const char = candidate[i];
		if (escaped) {
			escaped = false;
			continue;
		}
		if (char === '\\') {
			escaped = true;
			continue;
		}
		if (char === '"') inString = !inString;
		if (inString) continue;
		if (char === opener) depth += 1;
		else if (char === closer) {
			depth -= 1;
			if (depth === 0) {
				try {
					return JSON.parse(candidate.slice(start, i + 1)) as T;
				} catch {
					return null;
				}
			}
		}
	}
	return null;
}
