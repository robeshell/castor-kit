/**
 * AI Text-to-SQL business logic
 *
 * Natural language → the model (common/ai.ts, generateText) writes SQL → safety check → run on the read-only engine.
 * Error branches:
 * - problems the operator can fix (LlmConfigError: model not configured, an error status from the model API, a reply
 *   that isn't a chat completion, no text) → 500 `AI 生成失败…` with the status when there is one
 * - anything else (network, timeout) → 500 `AI 生成失败`
 */

import { APICallError, generateText, InvalidResponseDataError, JSONParseError, TypeValidationError } from 'ai'
import type { Agent } from 'undici'
import { AI_CALL_DEFAULTS, aiConfigured, createAiAgent, languageModelFor, upstreamStatusOf } from '@/common/ai'
import { DEMO_MAX_OUTPUT_TOKENS } from '@/common/demo'
import type { AppConfig } from '@/config'
import type { Settings } from '@/common/settings'
import { AiSqlRepository, type ColumnInfo } from './repository'
import { MAX_SQL_ROWS, cleanSql, isVisibleTable, wrapReadonlySql } from './schema'
import { pgToPy, toResponseValue } from './pg-values'

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

/** The model API answered 2xx, but not with something the provider could read */
function isMalformedReply(err: unknown): boolean {
  if (JSONParseError.isInstance(err) || TypeValidationError.isInstance(err) || InvalidResponseDataError.isInstance(err)) return true
  return APICallError.isInstance(err) && Boolean(err.statusCode && err.statusCode >= 200 && err.statusCode < 300)
}

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
    private readonly config: Partial<Pick<AppConfig, 'demoMode'>>,
    /** Current model settings (system settings → AI), read on every call */
    private readonly ai: () => Promise<Settings['ai']>,
    /** allowPrivate: the AI API may be on an internal network (common/outbound.ts) */
    options: { llmTimeoutMs?: number; allowPrivate?: boolean } = {},
  ) {
    this.repo = repo
    const timeout = options.llmTimeoutMs ?? LLM_TIMEOUT_MS
    this.dispatcher = createAiAgent(options.allowPrivate ?? false, timeout)
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
    const ai = await this.ai()
    if (!aiConfigured(ai)) throw new LlmConfigError('未配置 AI 模型，请在「系统设置 → AI」中填写 API Key 和模型名')

    const system =
      '你是一个 PostgreSQL 专家。用户会给你一个问题，你只需返回一条合法的 PostgreSQL SELECT 语句，' +
      '不要有任何解释、注释或 Markdown 格式。\n\n' +
      '规则：\n' +
      '1. 只写 SELECT 语句（允许 WITH CTE）\n' +
      '2. 若结果可能很多，自动加 LIMIT 200\n' +
      '3. 时间字段用 DATE_TRUNC 或 TO_CHAR 格式化\n' +
      '4. 返回内容只有 SQL，不带任何其他文字'

    let result: Awaited<ReturnType<typeof generateText>>
    try {
      result = await generateText({
        ...AI_CALL_DEFAULTS,
        model: languageModelFor(ai, this.dispatcher),
        system,
        prompt: `数据库结构如下：\n\n${schema}\n\n问题：${question}`,
        ...(this.config.demoMode ? { maxOutputTokens: DEMO_MAX_OUTPUT_TOKENS.sql } : {}),
      })
    } catch (err) {
      const status = upstreamStatusOf(err)
      if (status) throw new LlmConfigError(`LLM 接口错误 (${status})`, status)
      // A 2xx reply that isn't a chat completion: the API URL or provider type is wrong
      if (isMalformedReply(err)) throw new LlmConfigError('LLM 响应格式不正确')
      throw err
    }
    if (!result.text.trim()) {
      // A reply without text is a model / settings problem (e.g. finish reason "length": the output cap was spent on thinking)
      throw new LlmConfigError(`LLM 没有返回内容（finish_reason: ${result.finishReason}）`)
    }
    return cleanSql(result.text)
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
