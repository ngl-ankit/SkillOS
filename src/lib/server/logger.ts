type Level = 'info' | 'warn' | 'error';

/** Minimal structured logger. Never pass secrets or learner content here. */
function write(level: Level, event: string, meta?: Record<string, unknown>) {
	if (process.env.NODE_ENV === 'test' && level !== 'error') return;
	const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...meta });
	if (level === 'error') console.error(line);
	else if (level === 'warn') console.warn(line);
	else console.info(line);
}

export const logger = {
	info: (event: string, meta?: Record<string, unknown>) => write('info', event, meta),
	warn: (event: string, meta?: Record<string, unknown>) => write('warn', event, meta),
	error: (event: string, err?: unknown, meta?: Record<string, unknown>) =>
		write('error', event, { ...meta, error: err instanceof Error ? err.message : err === undefined ? undefined : String(err) })
};
