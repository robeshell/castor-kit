/**
 * AI Text-to-SQL business logic
 *
 * Natural language → LLM generates SQL → safety check → run on the read-only engine. Error branches:
 * - LLM config/response errors (LlmConfigError: key not configured, non-200, response not JSON, invalid URL)
 *   → 500 `AI 生成失败，请检查模型配置后重试`
 * - other exceptions (network, timeout, unexpected response shape) → 500 `AI 生成失败`
 */

import { Agent, fetch } from 'undici'
import { DEMO_MAX_OUTPUT_TOKENS } from '@/common/demo'
import type { AppConfig } from '@/config'
import { AiSqlRepository, type ColumnInfo } from './repository'
import { MAX_SQL_ROWS, cleanSql, isVisibleTable, wrapReadonlySql } from './schema'
import { pgToPy, toResponseValue } from './pg-values'

/** LLM config / upstream response problems */
/** Model call failed in a way the operator can fix (config, quota, model name); upstreamStatus is the model API's HTTP status */
export class LlmConfigError extends Error {
  constructor(
    message: string,
    readonly upstreamStatus?: number,
  ) {
    super(message)
  }
}

const LLM_TIMEOUT_MS = 30_000

export interface SqlResult {
  columns: string[]
  rows: Record<string, unknown>[]
  row_count: number
  truncated: boolean
}

function codepointCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export class AiSqlService {
  private readonly repo: AiSqlRepository
  private readonly dispatcher: Agent

  constructor(
    repo: AiSqlRepository,
    private readonly config: Pick<AppConfig, 'aiApiBase' | 'aiApiKey' | 'aiModel'> & Partial<Pick<AppConfig, 'demoMode'>>,
    options: { llmTimeoutMs?: number } = {},
  ) {
    this.repo = repo
    const timeout = options.llmTimeoutMs ?? LLM_TIMEOUT_MS
    this.dispatcher = new Agent({ connect: { timeout }, headersTimeout: timeout, bodyTimeout: timeout })
  }

  async close(): Promise<void> {
    await this.dispatcher.destroy()
  }

  /** Visible business table names (sorted) */
  async visibleTables(): Promise<string[]> {
    const names = await this.repo.listTableNames()
    return names.filter(isVisibleTable).sort(codepointCompare)
  }

  /** Read business table structure and return LLM-readable text (sensitive tables are never exposed) */
  async getDbSchema(): Promise<string> {
    const tables = await this.visibleTables()
    const byTable = new Map<string, ColumnInfo[]>()
    for (const col of await this.repo.listColumns()) {
      const list = byTable.get(col.table) ?? []
      list.push(col)
      byTable.set(col.table, list)
    }
    return tables
      .map((tname) => {
        const colLines = (byTable.get(tname) ?? []).map((col) => {
          const nullable = col.nullable ? '' : ' NOT NULL'
          const dflt = col.default !== null ? ` DEFAULT ${col.default}` : ''
          return `  ${col.name}  ${col.type}${nullable}${dflt}`
        })
        return `TABLE ${tname} (\n` + colLines.join(',\n') + '\n)'
      })
      .join('\n\n')
  }

  /** Call the LLM to generate SQL */
  async callLlm(question: string, schema: string): Promise<string> {
    const { aiApiBase: base, aiApiKey: key, aiModel: model } = this.config
    if (!key) throw new LlmConfigError('未配置 AI_API_KEY 环境变量')

    const systemMsg = {
      role: 'system',
      content:
        '你是一个 PostgreSQL 专家。用户会给你一个问题，你只需返回一条合法的 PostgreSQL SELECT 语句，' +
        '不要有任何解释、注释或 Markdown 格式。\n\n' +
        '规则：\n' +
        '1. 只写 SELECT 语句（允许 WITH CTE）\n' +
        '2. 若结果可能很多，自动加 LIMIT 200\n' +
        '3. 时间字段用 DATE_TRUNC 或 TO_CHAR 格式化\n' +
        '4. 返回内容只有 SQL，不带任何其他文字',
    }
    const userMsg = { role: 'user', content: `数据库结构如下：\n\n${schema}\n\n问题：${question}` }

    const url = `${base}/chat/completions`
    // requests raises MissingSchema/InvalidSchema/InvalidURL for a missing scheme / non-http(s) / invalid URL (all ValueError subclasses)
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      throw new LlmConfigError(`Invalid URL: ${url}`)
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new LlmConfigError(`No connection adapters for ${url}`)

    const resp = await fetch(parsed, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [systemMsg, userMsg],
        ...(this.config.demoMode ? { max_tokens: DEMO_MAX_OUTPUT_TOKENS.sql } : {}),
      }),
      dispatcher: this.dispatcher,
    })
    if (resp.status !== 200) {
      const text = await resp.text().catch(() => '')
      throw new LlmConfigError(`LLM 接口错误 (${resp.status}): ${text.slice(0, 300)}`, resp.status)
    }
    let data: unknown
    try {
      data = JSON.parse(await resp.text())
    } catch {
      // requests' JSONDecodeError is a ValueError subclass
      throw new LlmConfigError('LLM 响应不是合法 JSON')
    }
    const choice = (data as { choices: { message?: { content?: unknown }; finish_reason?: unknown }[] }).choices[0]!
    const rawSql = choice.message?.content
    if (typeof rawSql !== 'string' || !rawSql.trim()) {
      // A reply without text is a model / settings problem (e.g. finish_reason "length": the output cap was spent on thinking)
      throw new LlmConfigError(`LLM 没有返回内容（finish_reason: ${String(choice.finish_reason ?? 'unknown')}）`)
    }
    return cleanSql(rawSql)
  }

  /** Execute SQL on the read-only engine, returning columns + rows + truncated */
  async executeSql(sql: string): Promise<SqlResult> {
    const result = await this.repo.execute(wrapReadonlySql(sql))
    const columns = result.fields.map((f) => f.name)
    const rowsRaw = result.rows
    const truncated = rowsRaw.length > MAX_SQL_ROWS
    const rows = rowsRaw.slice(0, MAX_SQL_ROWS).map((raw) => {
      const row: Record<string, unknown> = {}
      columns.forEach((col, i) => {
        row[col] = toResponseValue(pgToPy(raw[i] ?? null, result.fields[i]!.dataTypeID))
      })
      return row
    })
    return { columns, rows, row_count: rows.length, truncated }
  }
}
