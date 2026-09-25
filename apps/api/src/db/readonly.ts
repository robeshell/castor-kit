/**
 * AI SQL 专用只读数据库访问层
 *
 * 为 AI Text-to-SQL 提供独立、强制只读的连接池，避免用户提交的任意 SELECT 在应用主库连接
 * （生产为超级用户）上执行。纵深防御：
 * 1. 独立 pg.Pool，生产通过 AI_SQL_DATABASE_URL 指向非超级用户只读账号 castor_kit_ro
 *    （缺失时 config.ts 直接 fail-closed，开发/测试回退主库 URL）。
 * 2. 连接启动参数 `-c default_transaction_read_only=on -c statement_timeout=<ms>`，
 *    在物理连接建立阶段就强制只读，早于任何用户 SQL。
 * 3. 每次查询都在 `BEGIN READ ONLY` 事务里再 `SET LOCAL` 一遍只读与超时，抵消池化连接上
 *    被 set_config 毒化（翻回可写）的可能；事务结束一律 ROLLBACK。
 * 4. 走扩展查询协议（extended protocol），单次调用只能执行一条语句。
 *
 * 该连接池不注册进 app.db，业务写操作不感知、不受影响。
 */

import pg from 'pg'

/** 所有列都按文本原样返回，由调用方按列类型转换 */
const RAW_TEXT_TYPES = {
  getTypeParser: () => (value: string) => value,
} as unknown as pg.CustomTypesConfig

export interface ReadonlyField {
  name: string
  dataTypeID: number
}

export interface ReadonlyResult {
  fields: ReadonlyField[]
  /** 每行按列顺序的原始文本值（NULL 为 null） */
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
    // 空闲连接出错（如数据库重启）不应让进程崩溃，下一次 connect 会重建
    this.pool.on('error', () => {})
  }

  /**
   * 在只读事务里执行一条 SQL，返回列信息与原始文本行。
   * 出错时连接直接销毁（不放回池），避免把状态异常的连接交给下一次请求。
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
