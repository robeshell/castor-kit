/**
 * Scheduled task schema layer
 *
 * Cron parsing / URL SSRF protection live in common/scheduler (also used by the scheduler and worker); this file holds the module's own
 * bool / int / JSON object parsing and the normalize* helpers used by the service.
 *
 * Scheduled tasks have no export endpoint, so this module defines no EXPORT_FIELD_MAP.
 */

import { z } from 'zod'
import { pyInt, pyStr, pyTruthy } from '@/common/py'
import { ScheduledTaskSchemaError } from '@/common/scheduler/errors'
import { pyStrip } from '@/common/scheduler/py-compat'
import { isPyDict, pyJsonDumps, pyJsonLoads, PyJsonDecodeError, type PyJson } from '@/common/scheduler/py-json'

/** Request body: loose + all optional; normalization happens in the service */
export const scheduledTaskBodySchema = z.record(z.string(), z.unknown()).nullish()

export const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])

/** Falsy → ''; otherwise stringify and trim */
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

/** parse_int(value, default): `int(value)`, returning the default on TypeError / ValueError */
export function parseIntValue(value: unknown, fallback: number): number {
  try {
    return pyInt(value)
  } catch {
    return fallback
  }
}

/** parse_json_object(value, default={}): returns a dict (a Map or a plain object from the request body) */
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
