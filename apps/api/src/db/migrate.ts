/**
 * Migration runner: applies migrations under drizzle/ in order (drizzle-orm migrator, tracked in drizzle.__drizzle_migrations).
 *
 * CLI entry point: see migrate-cli.ts (`pnpm db:migrate` / `node dist/migrate.js`)
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { createDb } from './client'

const MIGRATIONS_SCHEMA = 'drizzle'
const MIGRATIONS_TABLE = '__drizzle_migrations'

/**
 * Migrations directory: MIGRATIONS_DIR if set; otherwise walk up from this file to the drizzle directory containing meta/_journal.json.
 * Works for source (src/db/), tsup output (dist/db/ or bundled into dist/chunk-*.js), and the Docker image layout.
 */
export function resolveMigrationsFolder(): string {
  if (process.env.MIGRATIONS_DIR) return resolve(process.env.MIGRATIONS_DIR)
  let dir = dirname(fileURLToPath(import.meta.url))
  for (let i = 0; i < 6; i += 1) {
    const candidate = join(dir, 'drizzle')
    if (existsSync(join(candidate, 'meta', '_journal.json'))) return candidate
    dir = dirname(dir)
  }
  throw new Error('drizzle migrations directory not found (set MIGRATIONS_DIR)')
}

/** Rows in drizzle.__drizzle_migrations (0 before the first migration created the table) */
async function appliedCount(pool: ReturnType<typeof createDb>['pool']): Promise<number> {
  const exists = await pool.query<{ t: string | null }>(`SELECT to_regclass('${MIGRATIONS_SCHEMA}.${MIGRATIONS_TABLE}') AS t`)
  if (!exists.rows[0]?.t) return 0
  const res = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${MIGRATIONS_SCHEMA}.${MIGRATIONS_TABLE}`)
  return res.rows[0]?.n ?? 0
}

export async function runMigrations(databaseUrl: string, log: (msg: string) => void = console.log): Promise<void> {
  const { pool, db } = createDb(databaseUrl, { max: 1 })
  try {
    const migrationsFolder = resolveMigrationsFolder()
    const before = await appliedCount(pool)
    await migrate(db, { migrationsFolder, migrationsSchema: MIGRATIONS_SCHEMA, migrationsTable: MIGRATIONS_TABLE })
    const after = await appliedCount(pool)
    // Migrations apply in journal order, so the n-th applied one is the journal's n-th entry
    const journal = JSON.parse(readFileSync(join(migrationsFolder, 'meta', '_journal.json'), 'utf8')) as { entries: Array<{ tag: string }> }
    const head = journal.entries[after - 1]?.tag ?? 'none'
    const applied = after - before
    log(applied > 0 ? `Applied ${applied} migration${applied === 1 ? '' : 's'}; the database is at ${head}` : `No new migrations; the database is at ${head}`)
  } finally {
    await pool.end()
  }
}
