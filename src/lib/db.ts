import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Returns the D1 binding. Works in `next dev` (async path) and in the deployed
 * Worker. Throws clearly if the binding is missing (misconfigured wrangler).
 */
export async function getDB(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.DB) {
    throw new Error(
      "D1 binding `DB` is missing — check wrangler.toml [[d1_databases]] and run `npm run cf-typegen`.",
    );
  }
  return env.DB;
}

/** Run a parameterized query and return typed rows. */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const db = await getDB();
  const stmt = params.length ? db.prepare(sql).bind(...params) : db.prepare(sql);
  const { results } = await stmt.all<T>();
  return results ?? [];
}

/** Run a query expected to return a single row (or null). */
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}
