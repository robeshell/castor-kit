/**
 * pg Pool + Drizzle 实例
 *
 * 类型解析器：`timestamp without time zone`(1114) 与 `date`(1082) 原样保留文本。pg 默认会按本地时区
 * 解析成 `Date`（偏移 8 小时且丢微秒），无法复现 Python `isoformat()`（rewrite-plan §2.2）。
 * Drizzle 自己的查询在 schema 里已声明 mode:'string'；这里的全局设置覆盖裸 `pool.query()`。
 */

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema'

pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (v) => v)
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v)

export type Db = NodePgDatabase<typeof schema>
/** db.transaction 回调里的事务对象 */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
/** repository 方法接受普通连接或事务（需要事务时由 service 传入 tx） */
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
