/**
 * pg Pool + Drizzle instance
 *
 * Type parsers: `timestamp without time zone` (1114) and `date` (1082) are kept as raw text. By default pg parses them
 * into `Date` in the local time zone (8-hour offset, microseconds lost), making UTC text with microseconds impossible (see common/serialize.toIso).
 * Drizzle's own queries already declare mode:'string' in the schema; this global setting covers raw `pool.query()`.
 */

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema'

pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (v) => v)
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v)

export type Db = NodePgDatabase<typeof schema>
/** Transaction object inside a db.transaction callback */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
/** Repository methods accept a plain connection or a transaction (the service passes tx when a transaction is needed) */
export type Executor = Db | Tx

export interface DbHandle {
  pool: pg.Pool
  db: Db
}

export function createDb(connectionString: string, options: pg.PoolConfig = {}): DbHandle {
  const pool = new pg.Pool({ connectionString, max: 10, ...options })
  const db = drizzle({ client: pool, schema })
  return { pool, db }
}
