/** Shared, dependency-free helpers used on both server and client. */

export function cx(...parts: Array<string | false | null | undefined>): string {
	return parts.filter(Boolean).join(' ');
}

export function todayISO(now: Date = new Date(), timeZone?: string): string {
	try {
		return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
	} catch {
		return now.toISOString().slice(0, 10);
	}
}

export function addDaysISO(iso: string, days: number): string {
	const d = new Date(`${iso}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
	return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function humanMinutes(minutes: number): string {
	if (!Number.isFinite(minutes) || minutes <= 0) return '0 min';
	const m = Math.round(minutes);
	if (m < 60) return `${m} min`;
	const h = Math.floor(m / 60);
	const rest = m % 60;
	if (rest === 0) return `${h} hr`;
	if (rest < 10) return `${h} hr ${rest} min`;
	return `${h}h ${rest}m`;
}

export function humanHours(minutes: number): string {
	const m = Math.round(minutes);
	if (m < 60) return `${m} min`;
	const hours = m / 60;
	return hours >= 10 ? `${Math.round(hours)} hr` : `${hours.toFixed(hours % 1 === 0 ? 0 : 1)} hr`;
}

export function relTime(input: Date | string | number, now: Date = new Date()): string {
	const then = input instanceof Date ? input : new Date(input);
	const diff = Math.round((then.getTime() - now.getTime()) / 1000);
	const abs = Math.abs(diff);
	const units: [Intl.RelativeTimeFormatUnit, number][] = [
		['year', 31_536_000],
		['month', 2_592_000],
		['week', 604_800],
		['day', 86_400],
		['hour', 3_600],
		['minute', 60]
	];
	const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
	for (const [unit, secs] of units) {
		if (abs >= secs) return rtf.format(Math.round(diff / secs), unit);
	}
	return 'just now';
}

export function formatDate(input: Date | string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
	if (!input) return '—';
	const d = input instanceof Date ? input : new Date(input);
	if (Number.isNaN(d.getTime())) return '—';
	return new Intl.DateTimeFormat('en', opts ?? { month: 'short', day: 'numeric' }).format(d);
}

export function formatDateTime(input: Date | string | null | undefined): string {
	if (!input) return '—';
	const d = input instanceof Date ? input : new Date(input);
	if (Number.isNaN(d.getTime())) return '—';
	return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
}

export function clamp(n: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, n));
}

export function pct(done: number, total: number): number {
	if (total <= 0) return 0;
	return clamp(Math.round((done / total) * 100), 0, 100);
}

export function initials(name: string): string {
	const parts = name.trim().split(/\s+/).slice(0, 2);
	return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export function difficultyLabel(level: number): string {
	return ['', 'Foundational', 'Easy', 'Moderate', 'Hard', 'Advanced'][clamp(Math.round(level), 0, 5)] ?? 'Moderate';
}

export function slugify(input: string): string {
	return input
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 72);
}

export function truncate(input: string, max = 160): string {
	const clean = input.replace(/\s+/g, ' ').trim();
	return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, wait = 220) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const wrapped = (...args: A) => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => fn(...args), wait);
	};
	wrapped.cancel = () => {
		if (timer) clearTimeout(timer);
	};
	return wrapped;
}
