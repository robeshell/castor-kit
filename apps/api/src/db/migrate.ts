/**
 * 迁移执行器（含 Alembic → Drizzle 的 baseline 接管逻辑，rewrite-plan §8）
 *
 * - 库里有 `alembic_version` 且 Drizzle 迁移记录为空：说明是 AuraStack 建好的现库，表已存在。
 *   只把 0000_baseline 记为已应用（写记录，不执行 DDL），之后的迁移正常执行。
 *   前提是 Alembic 必须处于 baseline 对应的 head，否则表结构对不上，直接拒绝。
 * - 全新空库：正常执行 baseline 及之后的全部迁移。
 *
 * 命令行入口见 migrate-cli.ts（`pnpm db:migrate` / `node dist/migrate.js`）
 */

import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { createDb } from './client'

/** baseline 等价的 Alembic head（AuraStack backend/migrations/versions/5a9f3c2e8d71_*.py） */
export const BASELINE_ALEMBIC_REVISION = '5a9f3c2e8d71'
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

export interface MigrateResult {
  baselineMarked: boolean
}

export async function runMigrations(
  databaseUrl: string,
  log: (msg: string) => void = console.log,
): Promise<MigrateResult> {
  const { pool, db } = createDb(databaseUrl, { max: 1 })
  const migrationsFolder = resolveMigrationsFolder()
  const migrationsConfig = {
    migrationsFolder,
    migrationsSchema: MIGRATIONS_SCHEMA,
    migrationsTable: MIGRATIONS_TABLE,
  }
  let baselineMarked = false
  try {
    const { rows } = await pool.query<{ alembic: string | null; drizzle: string | null }>(
      `SELECT to_regclass('public.alembic_version')::text AS alembic,
              to_regclass($1)::text AS drizzle`,
      [`${MIGRATIONS_SCHEMA}.${MIGRATIONS_TABLE}`],
    )
    const hasAlembic = Boolean(rows[0]?.alembic)
    let drizzleCount = 0
    if (rows[0]?.drizzle) {
      const res = await pool.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}"`,
      )
      drizzleCount = res.rows[0]?.n ?? 0
    }

    if (hasAlembic && drizzleCount === 0) {
      const { rows: versionRows } = await pool.query<{ version_num: string }>(
        'SELECT version_num FROM alembic_version',
      )
      const versions = versionRows.map((r) => r.version_num)
      if (versions.length !== 1 || versions[0] !== BASELINE_ALEMBIC_REVISION) {
        throw new Error(
          `alembic_version=${versions.join(',') || '(空)'}，与 baseline 对应的 ${BASELINE_ALEMBIC_REVISION} 不一致；` +
            '请先在 AuraStack 执行 flask db upgrade 到 head，再运行本迁移。',
        )
      }
      const [baseline] = readMigrationFiles(migrationsConfig)
      if (!baseline) throw new Error(`未找到 baseline 迁移文件：${migrationsFolder}`)

      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query(`CREATE SCHEMA IF NOT EXISTS "${MIGRATIONS_SCHEMA}"`)
        // 表结构与 drizzle-orm 迁移器自建的保持一致
        await client.query(
          `CREATE TABLE IF NOT EXISTS "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" (
             id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`,
        )
        await client.query(
          `INSERT INTO "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" (hash, created_at) VALUES ($1, $2)`,
          [baseline.hash, baseline.folderMillis],
        )
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
      baselineMarked = true
      log(`检测到 AuraStack 现库（alembic ${BASELINE_ALEMBIC_REVISION}）：baseline 已标记为已应用，未执行 DDL`)
    }

    await migrate(db, migrationsConfig)
    log('迁移完成')
    return { baselineMarked }
  } finally {
    await pool.end()
  }
}
