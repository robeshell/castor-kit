/**
 * Scheduled task service layer
 *
 * Intentionally preserved API behavior (see inline comments):
 * - A failed manual run returns 500, but the body is the full {message, task, run, error} (not a generic error message)
 *
 * Design notes:
 * - On create, an invalid request URL returns 400 + the specific reason (not a generic 500),
 *   validated after name / code / Cron to match the form field order
 * - A malformed URL (URL parse failure, e.g. `http://[::1/x`) returns 400 "请求地址格式不合法" on both create and update
 *
 * "Now" is always the DB UTC time text (never JS Date), and cron is computed from it.
 */

import { writeError } from '@/common/db-errors'
import { internalError, ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { computeNextRunAt, parseCronExpression, parseTimestamp, toEpochMicros } from '@/common/scheduler/cron'
import { ScheduledTaskSchemaError } from '@/common/scheduler/errors'
import { executeHttpRequest, type HttpExecutor, type HttpRequestSpec } from '@/common/scheduler/http'
import { validateRequestUrl, type HostLookup } from '@/common/scheduler/ssrf'
import { changedFields } from '@/common/validation'
import type { Db } from '@/db/client'
import { scheduledTaskRunToDict, scheduledTaskToDict, type ScheduledTask } from '@/db/schema'
import { ScheduledTaskRepository, type TaskChanges } from './repository'
import { clampTimeout, type TaskInput } from './schema'

export interface ScheduledTaskServiceOptions {
  /** HTTP executor (defaults to an undici implementation with connection-level SSRF re-checks; injectable for tests) */
  httpExecutor?: HttpExecutor
  /** DNS resolution for URL validation (defaults to dns.lookup; injectable for tests) */
  lookup?: HostLookup
}

const RESPONSE_BODY_LIMIT = 2000

/** ScheduledTaskSchemaError (cron / URL) → 400; DB input errors → 400; other unexpected errors → 500 */
function toServiceError(err: unknown): never {
  if (err instanceof ServiceError) throw err
  if (err instanceof ScheduledTaskSchemaError) throw new ServiceError(err.message, 400)
  throw writeError(err)
}

/** The first `limit` characters (code points) */
function truncateText(text: string, limit = RESPONSE_BODY_LIMIT): string {
  if (text.length <= limit) return text
  let out = ''
  let n = 0
  for (const ch of text) {
    if (n >= limit) break
    out += ch
    n += 1
  }
  return out
}

export class ScheduledTaskService {
  readonly repo: ScheduledTaskRepository
  private readonly httpExecutor: HttpExecutor
  private readonly lookup: HostLookup | undefined

  constructor(
    private readonly db: Db,
    options: ScheduledTaskServiceOptions = {},
  ) {
    this.repo = new ScheduledTaskRepository(db)
    this.httpExecutor = options.httpExecutor ?? executeHttpRequest
    this.lookup = options.lookup
  }

  private validateUrl(raw: string | null): Promise<string> {
    return validateRequestUrl(raw, this.lookup ? { lookup: this.lookup } : {})
  }

  async listTasks(page: number, perPage: number, search: string, isActive: boolean | null, status: string) {
    const { total, items } = await this.repo.listTasks(page, perPage, { search, isActive, status })
    return { items: items.map(scheduledTaskToDict), total, page, per_page: perPage }
  }

  async listRuns(page: number, perPage: number, taskId: number | null, status: string) {
    const { total, items } = await this.repo.listRuns(page, perPage, { taskId, status })
    return { items: items.map(({ run, task }) => scheduledTaskRunToDict(run, task)), total, page, per_page: perPage }
  }

  async getTaskOr404(id: number): Promise<ScheduledTask> {
    const task = await this.repo.getTask(id)
    if (!task) throw notFound()
    return task
  }

  async createTask(values: TaskInput) {
    let task
    try {
      const requestUrl = await this.validateUrl(values.request_url)
      if (await this.repo.getTaskByCode(values.task_code)) throw new ServiceError('任务编码已存在', 400)
      parseCronExpression(values.cron_expression)
      const nextRunAt = values.is_active ? computeNextRunAt(values.cron_expression, await this.repo.utcNow()) : null
      task = await this.repo.insertTask({
        ...values,
        request_url: requestUrl,
        timeout_seconds: clampTimeout(values.timeout_seconds),
        last_status: 'idle',
        run_count: 0,
        next_run_at: nextRunAt,
      })
    } catch (err) {
      toServiceError(err)
    }
    return scheduledTaskToDict(task)
  }

  async updateTask(task: ScheduledTask, values: Partial<TaskInput>) {
    let changes: TaskChanges
    try {
      if (values.task_code !== undefined && (await this.repo.findOtherTaskByCode(values.task_code, task.id))) {
        throw new ServiceError('任务编码已存在', 400)
      }
      if (values.cron_expression !== undefined) parseCronExpression(values.cron_expression)
      const next: ScheduledTask = { ...task, ...values } as ScheduledTask
      if (values.request_url !== undefined) next.request_url = await this.validateUrl(values.request_url)
      if (values.timeout_seconds !== undefined) next.timeout_seconds = clampTimeout(values.timeout_seconds)
      next.next_run_at = next.is_active ? computeNextRunAt(next.cron_expression, await this.repo.utcNow()) : null
      // Only send an UPDATE for columns that actually changed (updated_at is refreshed only then)
      changes = changedFields(task, next)
    } catch (err) {
      toServiceError(err)
    }
    if (Object.keys(changes).length === 0) return scheduledTaskToDict(task)

    try {
      const updated = await this.repo.updateTask(task.id, changes)
      if (!updated) throw new Error('任务已被删除')
      return scheduledTaskToDict(updated)
    } catch (err) {
      toServiceError(err)
    }
  }

  async deleteTask(task: ScheduledTask) {
    try {
      await this.repo.deleteTask(task.id)
      return { message: '删除成功' }
    } catch (err) {
      toServiceError(err)
    }
  }

  async runTaskNow(task: ScheduledTask) {
    try {
      return await this.executeTask(task, 'manual')
    } catch (err) {
      throw writeError(err)
    }
  }

  /** Stored request headers (a JSON object's text) → header values as strings; null values are left out */
  private parseHeaders(rawHeaders: string | null): Record<string, string> {
    if (!rawHeaders) return {}
    let parsed: unknown
    try {
      parsed = JSON.parse(rawHeaders)
    } catch {
      throw new ServiceError('请求头 JSON 解析失败', 400)
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new ServiceError('请求头必须是 JSON 对象', 400)
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => [k, typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v)]),
    )
  }

  /**
   * Perform one HTTP request and write a run record.
   * Request failures / HTTP >= 400 are recorded as failed (no throw); invalid headers throw ServiceError(400); DB write failures throw ServiceError(500).
   */
  async executeTask(task: ScheduledTask, triggerType: 'scheduled' | 'manual' = 'scheduled') {
    const startedAt = await this.repo.utcNow()
    let responseStatus: number | null = null
    let responseBody: string | null = null
    let errorMessage: string | null = null
    let status: 'success' | 'failed' = 'success'

    const method = (task.request_method || 'GET').toUpperCase()
    const headers = this.parseHeaders(task.request_headers)
    const timeoutSeconds = clampTimeout(task.timeout_seconds || 10)

    // A JSON object / array body is sent as JSON (with its Content-Type); any other text is sent as it is
    const requestBody = (task.request_body || '').trim()
    let body: HttpRequestSpec['body'] = null
    if (requestBody) {
      let parsed: unknown
      try {
        parsed = JSON.parse(requestBody)
      } catch {
        parsed = undefined
      }
      body = parsed !== null && typeof parsed === 'object' ? { kind: 'json', text: JSON.stringify(parsed) } : { kind: 'data', text: requestBody }
    }

    try {
      const response = await this.httpExecutor({ method, url: task.request_url, headers, body, timeoutSeconds })
      responseStatus = response.status
      responseBody = truncateText(response.text || '')
      if (response.status >= 400) throw new Error(`HTTP ${response.status}`)
    } catch (err) {
      status = 'failed'
      errorMessage = err instanceof Error ? err.message : String(err)
    }

    const finishedAt = await this.repo.utcNow()
    const diffMicros = toEpochMicros(parseTimestamp(finishedAt)) - toEpochMicros(parseTimestamp(startedAt))
    const durationMs = Math.trunc((diffMicros / 1e6) * 1000)

    let nextRunAt: string | null = null
    if (task.is_active) {
      try {
        nextRunAt = computeNextRunAt(task.cron_expression, finishedAt)
      } catch (err) {
        if (!(err instanceof ScheduledTaskSchemaError)) throw err
        status = 'failed'
        errorMessage = err.message
      }
    }

    let result
    try {
      result = await this.db.transaction(async (tx) => {
        const repo = new ScheduledTaskRepository(tx)
        const run = await repo.insertRun({
          task_id: task.id,
          trigger_type: triggerType,
          status,
          response_status: responseStatus,
          response_body: responseBody,
          error_message: errorMessage,
          started_at: startedAt,
          finished_at: finishedAt,
          duration_ms: durationMs,
        })
        const updated = await repo.recordTaskResult(task.id, {
          last_status: status,
          last_error: errorMessage,
          last_duration_ms: durationMs,
          last_run_at: finishedAt,
          next_run_at: nextRunAt,
        })
        if (!updated) throw new Error('任务已被删除')
        return { run, task: updated }
      })
    } catch (err) {
      throw internalError(err)
    }

    const payload: Record<string, unknown> = {
      message: status === 'success' ? '执行成功' : '执行失败',
      task: scheduledTaskToDict(result.task),
      run: scheduledTaskRunToDict(result.run, result.task),
    }
    if (status !== 'success') payload.error = errorMessage || '执行失败'
    return payload
  }
}

