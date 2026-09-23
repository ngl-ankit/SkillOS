import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env';
import * as schema from './schema';

export type Database = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
export type DbOrTx = Database | Tx;

const store = globalThis as unknown as { __skillosSql?: postgres.Sql; __skillosDb?: Database };

export function sslFor(url: string): 'require' | undefined {
	return /sslmode=require/.test(url) || /render\.com/.test(url) ? 'require' : undefined;
}

function create(): Database {
	const url = env().DATABASE_URL;
	const client =
		store.__skillosSql ??
		postgres(url, {
			max: Number(process.env.DATABASE_POOL_MAX ?? 10),
			idle_timeout: 20,
			connect_timeout: 15,
			ssl: sslFor(url),
			onnotice: () => {}
		});
	store.__skillosSql = client;
	return drizzle(client, { schema });
}

/** Lazily-initialised shared database handle (survives Vite HMR). */
export const db: Database = new Proxy({} as Database, {
	get(_target, prop) {
		if (!store.__skillosDb) store.__skillosDb = create();
		const value = Reflect.get(store.__skillosDb, prop);
		return typeof value === 'function' ? value.bind(store.__skillosDb) : value;
	}
});

export async function closeDb() {
	await store.__skillosSql?.end({ timeout: 5 });
	store.__skillosSql = undefined;
	store.__skillosDb = undefined;
}

export { schema };
