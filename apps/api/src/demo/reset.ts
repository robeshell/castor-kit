/**
 * Public demo data reset (DEMO_MODE).
 *
 * Restores the component gallery and the read-only system pages to DEMO_FIXTURES and clears logs, so visitors always
 * start from the same data. Never touches accounts, roles or menus (admin_users / roles / menus / role_menus / user_roles).
 *
 * Triggered at startup (setup-once) and hourly from the web process; a reset only runs when the last one is older than
 * DEMO_RESET_HOURS. A PostgreSQL advisory lock keeps concurrent instances from resetting at the same time.
 */

import pg from 'pg'
import { utcNowIso } from '@/common/serialize'
import { DEMO_FIXTURES, type FixtureRow } from './fixtures'

/** "CKDM" */
const DEMO_LOCK_KEY = 0x434b444d
const LAST_RESET_KEY = 'demo_last_reset_at'

/** Tables without fixtures that are emptied on reset (child rows and logs that grow on a public demo) */
const CLEARED_TABLES = ['notification_reads', 'scheduled_task_runs', 'query_management_versions', 'login_logs', 'operation_logs']

/** Fixture dates are written relative to this day and shifted by (today - DATE_BASE) at reset time */
const DATE_BASE = Date.UTC(2026, 2, 21)
const DATE_COLUMNS = new Set(['due_date', 'start_date', 'end_date', 'join_date', 'publish_at'])
const DAY_MS = 86_400_000

type Log = (msg: string) => void

export function shiftDate(value: unknown, days: number): unknown {
  if (typeof value !== 'string' || days === 0) return value
  const m = /^(\d{4}-\d{2}-\d{2})(.*)$/.exec(value)
  if (!m) return value
  const shifted = utcNowIso(new Date(Date.parse(`${m[1]}T00:00:00Z`) + days * DAY_MS)).slice(0, 10)
  return shifted + m[2]
}

/** JSON columns: node-postgres would send JS arrays as Postgres arrays, so objects / arrays are serialized explicitly */
function toParam(value: unknown): unknown {
  return value !== null && typeof value === 'object' ? JSON.stringify(value) : value
}

async function tableColumns(client: pg.ClientBase, table: string): Promise<Set<string>> {
  const { rows } = await client.query<{ column_name: string }>(
    'SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1',
    [table],
  )
  return new Set(rows.map((r) => r.column_name))
}

/** Replace the demo tables' contents with DEMO_FIXTURES (single transaction) */
export async function resetDemoData(client: pg.ClientBase, now = new Date()): Promise<void> {
  const days = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - DATE_BASE) / DAY_MS)
  const stamp = utcNowIso(now)
  const tables = [...DEMO_FIXTURES.map(([table]) => table), ...CLEARED_TABLES]

  await client.query('BEGIN')
  try {
    await client.query(`TRUNCATE ${tables.map((t) => client.escapeIdentifier(t)).join(', ')} RESTART IDENTITY CASCADE`)

    for (const [table, rows] of DEMO_FIXTURES) {
      if (rows.length === 0) continue
      const columns = await tableColumns(client, table)
      const withTimestamps = (row: FixtureRow): FixtureRow => ({
        ...row,
        ...(columns.has('created_at') ? { created_at: stamp } : {}),
        ...(columns.has('updated_at') ? { updated_at: stamp } : {}),
      })
      for (const raw of rows) {
        const row = withTimestamps(raw)
        const keys = Object.keys(row).filter((k) => columns.has(k))
        const values = keys.map((k) => toParam(DATE_COLUMNS.has(k) ? shiftDate(row[k], days) : row[k]))
        await client.query(
          `INSERT INTO ${client.escapeIdentifier(table)} (${keys.map((k) => client.escapeIdentifier(k)).join(', ')}) ` +
            `VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')})`,
          values,
        )
      }
      // Rows were inserted with explicit ids: move the serial sequence past them
      if (columns.has('id')) {
        await client.query(
          `SELECT setval(pg_get_serial_sequence($1, 'id'), (SELECT COALESCE(MAX(id), 0) + 1 FROM ${client.escapeIdentifier(table)}), false)`,
          [table],
        )
      }
    }

    await client.query(
      `INSERT INTO app_state (key, value, updated_at) VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
      [LAST_RESET_KEY, stamp, stamp],
    )
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  }
}

async function lastResetAt(client: pg.ClientBase): Promise<Date | null> {
  const { rows } = await client.query<{ value: string | null }>('SELECT value FROM app_state WHERE key = $1', [LAST_RESET_KEY])
  const value = rows[0]?.value
  // Stored by utcNowIso() without a zone suffix: parse as UTC
  return value ? new Date(Date.parse(`${value}Z`)) : null
}

export interface DemoResetOptions {
  databaseUrl: string
  resetHours: number
  /** Reset even if the last reset is recent (manual `pnpm demo:reset`) */
  force?: boolean
  log?: Log
  now?: Date
}

/** Reset the demo data when it is due; returns whether a reset ran */
export async function resetDemoIfDue(options: DemoResetOptions): Promise<boolean> {
  const log = options.log ?? console.log
  const now = options.now ?? new Date()
  const client = new pg.Client({ connectionString: options.databaseUrl })
  await client.connect()
  try {
    await client.query('SELECT pg_advisory_lock($1)', [DEMO_LOCK_KEY])
    const last = await lastResetAt(client)
    const due = options.force || !last || now.getTime() - last.getTime() >= options.resetHours * 3_600_000
    if (!due) return false
    log('[demo] 正在恢复演示数据...')
    await resetDemoData(client, now)
    log('[demo] 演示数据已恢复')
    return true
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [DEMO_LOCK_KEY]).catch(() => {})
    await client.end().catch(() => {})
  }
}
