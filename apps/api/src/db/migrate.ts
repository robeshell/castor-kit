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

/**
 * Applied migrations: how many, and the newest one's created_at (drizzle stores the journal entry's `when` there);
 * none before the first migration created the table
 */
async function applied(pool: ReturnType<typeof createDb>['pool']): Promise<{ count: number; last: number | null }> {
  const exists = await pool.query<{ t: string | null }>(`SELECT to_regclass('${MIGRATIONS_SCHEMA}.${MIGRATIONS_TABLE}') AS t`)
  if (!exists.rows[0]?.t) return { count: 0, last: null }
  const res = await pool.query<{ n: number; last: string | null }>(
    `SELECT count(*)::int AS n, max(created_at)::text AS last FROM ${MIGRATIONS_SCHEMA}.${MIGRATIONS_TABLE}`,
  )
  const row = res.rows[0]
  return { count: row?.n ?? 0, last: row?.last ? Number(row.last) : null }
}

export async function runMigrations(databaseUrl: string, log: (msg: string) => void = console.log): Promise<void> {
  const { pool, db } = createDb(databaseUrl, { max: 1 })
  try {
    const migrationsFolder = resolveMigrationsFolder()
    const before = await applied(pool)
    await migrate(db, { migrationsFolder, migrationsSchema: MIGRATIONS_SCHEMA, migrationsTable: MIGRATIONS_TABLE })
    const after = await applied(pool)
    const journal = JSON.parse(readFileSync(join(migrationsFolder, 'meta', '_journal.json'), 'utf8')) as { entries: Array<{ tag: string; when: number }> }
    const head =
      after.last === null
        ? 'none'
        : (journal.entries.find((e) => e.when === after.last)?.tag ?? 'a migration this checkout does not have (another branch applied it)')
    const count = after.count - before.count
    log(count > 0 ? `Applied ${count} migration${count === 1 ? '' : 's'}; the database is at ${head}` : `No new migrations; the database is at ${head}`)
  } finally {
    await pool.end()
  }
}
