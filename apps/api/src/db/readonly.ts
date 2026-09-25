/**
 * Read-only database access layer dedicated to AI SQL
 *
 * Provides AI Text-to-SQL with a separate, enforced read-only connection pool, so arbitrary user-submitted SELECTs never run on the app's main
 * DB connection (a superuser in production). Defense in depth:
 * 1. A separate pg.Pool; in production AI_SQL_DATABASE_URL points to the non-superuser read-only role castor_kit_ro
 *    (config.ts fails closed if it's missing; dev/test fall back to the main DB URL).
 * 2. Connection startup options `-c default_transaction_read_only=on -c statement_timeout=<ms>`
 *    enforce read-only when the physical connection is established, before any user SQL.
 * 3. Every query runs inside a `BEGIN READ ONLY` transaction that `SET LOCAL`s read-only and the timeout again, countering
 *    pooled connections poisoned via set_config (flipped back to writable); transactions always end with ROLLBACK.
 * 4. Uses the extended query protocol, so a single call can execute only one statement.
 *
 * This pool is not registered on app.db; business writes are unaware of and unaffected by it.
 */

import pg from 'pg'

/** Every column is returned as raw text; callers convert by column type */
const RAW_TEXT_TYPES = {
  getTypeParser: () => (value: string) => value,
} as unknown as pg.CustomTypesConfig

export interface ReadonlyField {
  name: string
  dataTypeID: number
}

export interface ReadonlyResult {
  fields: ReadonlyField[]
  /** Raw text values of each row in column order (NULL as null) */
  rows: (string | null)[][]
}

export class ReadonlyDb {
  readonly pool: pg.Pool
  private readonly timeoutMs: number

  constructor(connectionString: string, statementTimeoutMs: number, options: pg.PoolConfig = {}) {
    this.timeoutMs = Math.trunc(statementTimeoutMs)
    this.pool = new pg.Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      options: `-c default_transaction_read_only=on -c statement_timeout=${this.timeoutMs}`,
      ...options,
    })
    // An error on an idle connection (e.g. DB restart) must not crash the process; the next connect recreates it
    this.pool.on('error', () => {})
  }

  /**
   * Execute one SQL statement in a read-only transaction and return column info plus raw text rows.
   * On error the connection is destroyed (not returned to the pool), so a connection in a bad state is never handed to the next request.
   */
  async query(sql: string): Promise<ReadonlyResult> {
    const client = await this.pool.connect()
    let broken: Error | undefined
    try {
      await client.query('BEGIN READ ONLY')
      await client.query('SET LOCAL default_transaction_read_only = on')
      await client.query(`SET LOCAL statement_timeout = ${this.timeoutMs}`)
      const result = await client.query({
        text: sql,
        rowMode: 'array',
        types: RAW_TEXT_TYPES,
        queryMode: 'extended',
      } as pg.QueryArrayConfig)
      return {
        fields: result.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
        rows: result.rows as (string | null)[][],
      }
    } catch (err) {
      broken = err instanceof Error ? err : new Error(String(err))
      throw err
    } finally {
      try {
        await client.query('ROLLBACK')
        client.release()
      } catch {
        client.release(broken ?? true)
      }
    }
  }

  async close(): Promise<void> {
    await this.pool.end()
  }
}
