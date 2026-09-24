/**
 * 定时任务 schema 层（对齐 AuraStack backend/app/admin/schema/scheduled_task.py）
 *
 * cron 解析 / URL 防 SSRF 在 common/scheduler（调度器与 worker 也要用）；这里是本模块自己的
 * parse_bool / parse_int / parse_json_object 与 service 里的 _normalize_* 辅助函数，按 Python 原样实现。
 *
 * Python 里的 EXPORT_FIELD_MAP 没有任何路由使用（定时任务没有导出接口），不移植。
 */

import { z } from 'zod'
import { pyInt, pyStr, pyTruthy } from '@/common/py'
import { ScheduledTaskSchemaError } from '@/common/scheduler/errors'
import { pyStrip } from '@/common/scheduler/py-compat'
import { isPyDict, pyJsonDumps, pyJsonLoads, PyJsonDecodeError, type PyJson } from '@/common/scheduler/py-json'

/** 移植期请求体：loose + 全可选，归一化在 service 里做 */
export const scheduledTaskBodySchema = z.record(z.string(), z.unknown()).nullish()

export const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])

/** Python `str(value or '').strip()` */
export function pyText(value: unknown): string {
  return pyStrip(pyTruthy(value) ? pyStr(value) : '')
}

/** parse_bool(value, default) */
export function parseBool<T>(value: unknown, fallback: T): boolean | T {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'boolean') return value
  const raw = pyStrip(pyStr(value)).toLowerCase()
  if (['1', 'true', 'yes', 'on', '是', '启用'].includes(raw)) return true
  if (['0', 'false', 'no', 'off', '否', '停用'].includes(raw)) return false
  return fallback
}

/** parse_int(value, default)：`int(value)`，TypeError / ValueError 时返回默认值 */
export function parseIntValue(value: unknown, fallback: number): number {
  try {
    return pyInt(value)
  } catch {
    return fallback
  }
}

/** parse_json_object(value, default={})：返回 dict（Map 或请求体里的普通对象） */
export function parseJsonObject(value: unknown): Map<string, PyJson> | Record<string, unknown> {
  if (value === null || value === undefined) return {}
  if (isPyDict(value)) return value
  const text = pyStrip(pyStr(value))
  if (!text) return {}
  let parsed: PyJson
  try {
    parsed = pyJsonLoads(text)
  } catch (err) {
    if (err instanceof PyJsonDecodeError) throw new ScheduledTaskSchemaError('JSON 格式不合法')
    throw err
  }
  if (!isPyDict(parsed)) throw new ScheduledTaskSchemaError('JSON 内容必须是对象')
  return parsed
}

/** ScheduledTaskService._normalize_json_string */
export function normalizeJsonString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (isPyDict(value)) return pyJsonDumps(value, { ensureAscii: false })
  const text = pyStrip(pyStr(value))
  if (!text) return null
  return pyJsonDumps(parseJsonObject(text), { ensureAscii: false })
}

/** ScheduledTaskService._normalize_text */
export function normalizeText(value: unknown): string | null {
  return pyText(value) || null
}

/** `max(1, min(x, 120))` */
export function clampTimeout(value: number): number {
  return Math.max(1, Math.min(value, 120))
}
