/**
 * Migration runner: applies migrations under drizzle/ in order (drizzle-orm migrator, tracked in drizzle.__drizzle_migrations).
 *
 * CLI entry point: see migrate-cli.ts (`pnpm db:migrate` / `node dist/migrate.js`)
 */

import { existsSync } from 'node:fs'
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
  throw new Error('找不到 drizzle 迁移目录（可用 MIGRATIONS_DIR 指定）')
}

export async function runMigrations(databaseUrl: string, log: (msg: string) => void = console.log): Promise<void> {
  const { pool, db } = createDb(databaseUrl, { max: 1 })
  try {
    await migrate(db, {
      migrationsFolder: resolveMigrationsFolder(),
      migrationsSchema: MIGRATIONS_SCHEMA,
      migrationsTable: MIGRATIONS_TABLE,
    })
    log('迁移完成')
  } finally {
    await pool.end()
  }
}
