/**
 * 定时任务 service 层（对齐 AuraStack backend/app/admin/service/scheduled_task.py）
 *
 * 与 Python 保持一致的“怪”行为（有意保留，见各处注释）：
 * - 新增时 validate_request_url 在 try 之外调用，URL 为空 / 非 http(s) / 内网地址等在 Flask 里是未捕获异常 → 500
 * - 手动执行失败时返回 500，但响应体是完整的 {message, task, run, error}（不是通用错误文案）
 *
 * “当前时间”一律取数据库 UTC 时间文本（不经过 JS Date），cron 以它为基准计算。
 */

import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { pyInt, pyStr, pyTruthy } from '@/common/py'
import { computeNextRunAt, parseCronExpression, parseTimestamp, toEpochMicros } from '@/common/scheduler/cron'
import { ScheduledTaskSchemaError } from '@/common/scheduler/errors'
import { executeHttpRequest, type HttpExecutor, type HttpRequestSpec } from '@/common/scheduler/http'
import { pyStrip } from '@/common/scheduler/py-compat'
import { isPyDict, PyJsonDecodeError, pyJsonDumps, pyJsonLoads, pyValueStr, type PyJson } from '@/common/scheduler/py-json'
import { validateRequestUrl, type HostLookup } from '@/common/scheduler/ssrf'
import type { Db } from '@/db/client'
import { scheduledTaskRunToDict, scheduledTaskToDict, type ScheduledTask } from '@/db/schema'
import { ScheduledTaskRepository, type TaskChanges } from './repository'
import {
  ALLOWED_METHODS,
  clampTimeout,
  normalizeJsonString,
  normalizeText,
  parseBool,
  parseIntValue,
  parseJsonObject,
  pyText,
} from './schema'

type Data = Record<string, unknown>

export interface ScheduledTaskServiceOptions {
  /** HTTP 执行器（默认带连接级 SSRF 复检的 undici 实现；测试可注入） */
  httpExecutor?: HttpExecutor
  /** URL 校验时的 DNS 解析（默认 dns.lookup；测试可注入，对应 Python 测试里 patch socket.getaddrinfo） */
  lookup?: HostLookup
}

const RESPONSE_BODY_LIMIT = 2000

/** ScheduledTaskSchemaError → 400；其他（含 Python 未捕获的 ValueError）→ 500 */
function toServiceError(err: unknown, schemaStatus = 400): never {
  if (err instanceof ServiceError) throw err
  if (err instanceof ScheduledTaskSchemaError) throw new ServiceError(err.message, schemaStatus)
  throw new ServiceError(err instanceof Error ? err.message : String(err), 500)
}

/** `(text or '')[:2000]`：按码点截断 */
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

  private validateUrl(raw: unknown): Promise<string> {
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

  async createTask(data: Data) {
    const name = pyText(data.name)
    const taskCode = pyText(data.task_code)
    const cronExpression = pyText(data.cron_expression)
    let requestUrl: string
    try {
      requestUrl = await this.validateUrl(data.request_url)
    } catch (err) {
      // Python：validate_request_url 在 try 之外，ScheduledTaskSchemaError 没被 API 层捕获 → 500
      toServiceError(err, 500)
    }
    // str(data.get('request_method') or 'GET').strip().upper()
    const requestMethod = pyStrip(pyTruthy(data.request_method) ? pyStr(data.request_method) : 'GET').toUpperCase()

    if (!name) throw new ServiceError('任务名称不能为空', 400)
    if (!taskCode) throw new ServiceError('任务编码不能为空', 400)
    if (!cronExpression) throw new ServiceError('Cron 表达式不能为空', 400)
    if (!requestUrl) throw new ServiceError('请求地址不能为空', 400)
    if (!ALLOWED_METHODS.has(requestMethod)) throw new ServiceError('请求方法仅支持 GET/POST/PUT/DELETE/PATCH', 400)
    if (await this.repo.getTaskByCode(taskCode)) throw new ServiceError('任务编码已存在', 400)

    let isActive: boolean
    let timeoutSeconds: number
    let nextRunAt: string | null
    try {
      parseCronExpression(cronExpression)
      parseJsonObject(data.request_headers)
      isActive = parseBool(data.is_active, true)
      timeoutSeconds = clampTimeout(parseIntValue(data.timeout_seconds, 10))
      nextRunAt = isActive ? computeNextRunAt(cronExpression, await this.repo.utcNow()) : null
    } catch (err) {
      toServiceError(err)
    }

    let requestHeaders: string | null
    try {
      requestHeaders = normalizeJsonString(data.request_headers)
    } catch (err) {
      toServiceError(err, 500)
    }

    try {
      const task = await this.repo.insertTask({
        name,
        task_code: taskCode,
        cron_expression: cronExpression,
        request_method: requestMethod,
        request_url: requestUrl,
        request_headers: requestHeaders,
        request_body: normalizeText(data.request_body),
        timeout_seconds: timeoutSeconds,
        is_active: isActive,
        remark: normalizeText(data.remark),
        last_status: 'idle',
        run_count: 0,
        next_run_at: nextRunAt,
      })
      return scheduledTaskToDict(task)
    } catch (err) {
      toServiceError(err, 500)
    }
  }

  async updateTask(task: ScheduledTask, data: Data) {
    const has = (key: string) => Object.hasOwn(data, key)

    if (has('name') && !pyText(data.name)) throw new ServiceError('任务名称不能为空', 400)

    if (has('task_code')) {
      const nextCode = pyText(data.task_code)
      if (!nextCode) throw new ServiceError('任务编码不能为空', 400)
      if (await this.repo.findOtherTaskByCode(nextCode, task.id)) throw new ServiceError('任务编码已存在', 400)
    }

    if (has('request_method')) {
      const method = pyText(data.request_method).toUpperCase()
      if (!ALLOWED_METHODS.has(method)) throw new ServiceError('请求方法仅支持 GET/POST/PUT/DELETE/PATCH', 400)
    }

    try {
      if (has('cron_expression')) parseCronExpression(data.cron_expression)
      if (has('request_headers')) parseJsonObject(data.request_headers)
      if (has('request_url')) await this.validateUrl(data.request_url)
    } catch (err) {
      toServiceError(err)
    }

    // update_map：按 Python 的字段顺序逐个 setattr
    const next: ScheduledTask = { ...task }
    try {
      if (has('name')) next.name = pyText(data.name)
      if (has('task_code')) next.task_code = pyText(data.task_code)
      if (has('cron_expression')) next.cron_expression = pyText(data.cron_expression)
      if (has('request_method')) next.request_method = pyText(data.request_method).toUpperCase()
      if (has('request_url')) next.request_url = pyText(data.request_url)
      if (has('request_headers')) next.request_headers = normalizeJsonString(data.request_headers)
      if (has('request_body')) next.request_body = normalizeText(data.request_body)
      if (has('timeout_seconds')) next.timeout_seconds = clampTimeout(parseIntValue(data.timeout_seconds, task.timeout_seconds || 10))
      if (has('is_active')) next.is_active = parseBool(data.is_active, task.is_active)
      if (has('remark')) next.remark = normalizeText(data.remark)
    } catch (err) {
      // 前面已校验过，这里理论上不会失败；Python 在 try 之外 → 500
      toServiceError(err, 500)
    }

    try {
      next.next_run_at = next.is_active ? computeNextRunAt(next.cron_expression, await this.repo.utcNow()) : null
    } catch (err) {
      toServiceError(err)
    }

    // SQLAlchemy 只对真正变化的列发 UPDATE（也只有这时 onupdate 才刷新 updated_at）
    const fields = [
      'name', 'task_code', 'cron_expression', 'request_method', 'request_url', 'request_headers',
      'request_body', 'timeout_seconds', 'is_active', 'remark', 'next_run_at',
    ] as const
    const changes: TaskChanges = {}
    for (const field of fields) {
      if (next[field] !== task[field]) (changes as Record<string, unknown>)[field] = next[field]
    }
    if (Object.keys(changes).length === 0) return scheduledTaskToDict(task)

    try {
      const updated = await this.repo.updateTask(task.id, changes)
      if (!updated) throw new Error('任务已被删除')
      return scheduledTaskToDict(updated)
    } catch (err) {
      toServiceError(err, 500)
    }
  }

  async deleteTask(task: ScheduledTask) {
    try {
      await this.repo.deleteTask(task.id)
      return { message: '删除成功' }
    } catch (err) {
      toServiceError(err, 500)
    }
  }

  async runTaskNow(task: ScheduledTask) {
    try {
      return await this.executeTask(task, 'manual')
    } catch (err) {
      if (err instanceof ServiceError) throw err
      throw new ServiceError(err instanceof Error ? err.message : String(err), 500)
    }
  }

  /** ScheduledTaskService._parse_headers */
  private parseHeaders(rawHeaders: string | null): Record<string, string> {
    if (!rawHeaders) return {}
    let parsed: PyJson
    try {
      parsed = pyJsonLoads(rawHeaders)
    } catch (err) {
      if (err instanceof PyJsonDecodeError) throw new ServiceError('请求头 JSON 解析失败', 400)
      throw err
    }
    if (!(parsed instanceof Map)) throw new ServiceError('请求头必须是 JSON 对象', 400)
    const headers: Record<string, string> = {}
    for (const [k, v] of parsed) headers[pyValueStr(k)] = pyValueStr(v)
    return headers
  }

  /**
   * execute_task：执行一次 HTTP 请求并写执行记录。
   * 请求失败 / HTTP >= 400 记为 failed（不抛错）；请求头非法抛 ServiceError(400)；写库失败抛 ServiceError(500)。
   */
  async executeTask(task: ScheduledTask, triggerType: 'scheduled' | 'manual' = 'scheduled') {
    const startedAt = await this.repo.utcNow()
    let responseStatus: number | null = null
    let responseBody: string | null = null
    let errorMessage: string | null = null
    let status: 'success' | 'failed' = 'success'

    const method = (task.request_method || 'GET').toUpperCase()
    const headers = this.parseHeaders(task.request_headers)
    const timeoutSeconds = clampTimeout(pyInt(task.timeout_seconds || 10))

    const requestBody = pyStrip(task.request_body || '')
    let parsedBody: PyJson | undefined
    if (requestBody) {
      try {
        parsedBody = pyJsonLoads(requestBody)
      } catch (err) {
        if (!(err instanceof PyJsonDecodeError)) throw err
        parsedBody = requestBody
      }
    }

    try {
      let body: HttpRequestSpec['body'] = null
      if (parsedBody !== undefined) {
        // requests：dict/list → json=（json.dumps(allow_nan=False)）；其他 → data=str(parsed)
        body =
          Array.isArray(parsedBody) || isPyDict(parsedBody)
            ? { kind: 'json', text: pyJsonDumps(parsedBody, { ensureAscii: true, allowNan: false }) }
            : { kind: 'data', text: pyValueStr(parsedBody) }
      }
      const response = await this.httpExecutor({ method, url: task.request_url, headers, body, timeoutSeconds })
      responseStatus = response.status
      responseBody = truncateText(response.text || '')
      if (response.status >= 400) throw new Error(`HTTP ${response.status}`)
    } catch (err) {
      status = 'failed'
      errorMessage = err instanceof Error ? err.message : pyStr(err)
    }

    const finishedAt = await this.repo.utcNow()
    // int((finished_at - started_at).total_seconds() * 1000)
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
      throw new ServiceError(err instanceof Error ? err.message : String(err), 500)
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

