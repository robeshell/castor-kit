/**
 * 迁移执行器：按 drizzle/ 目录下的迁移依次执行（drizzle-orm migrator，记录在 drizzle.__drizzle_migrations）。
 *
 * 命令行入口见 migrate-cli.ts（`pnpm db:migrate` / `node dist/migrate.js`）
 */

import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { createDb } from './client'

const MIGRATIONS_SCHEMA = 'drizzle'
const MIGRATIONS_TABLE = '__drizzle_migrations'

/**
 * 迁移目录：优先 MIGRATIONS_DIR；否则从当前文件向上找含 meta/_journal.json 的 drizzle 目录。
 * 源码（src/db/）、tsup 产物（dist/db/ 或打进 dist/chunk-*.js）、Docker 镜像布局都能找到。
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
