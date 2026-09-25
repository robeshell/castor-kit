/**
 * 日志模块 schema 层
 */

import { pyInt } from '@/common/py'
import { formatDateTime } from '@/common/serialize'
import type { LoginLog, OperationLog } from '@/db/schema'

export const LOGIN_EXPORT_FIELD_MAP: Record<string, [string, (item: LoginLog) => unknown]> = {
  id: ['ID', (item) => item.id],
  username: ['用户名', (item) => item.username],
  status: ['状态', (item) => item.status],
  ip: ['IP 地址', (item) => item.ip || ''],
  user_agent: ['User-Agent', (item) => item.user_agent || ''],
  message: ['说明', (item) => item.message || ''],
  created_at: ['时间', (item) => formatDateTime(item.created_at)],
}

export const OPERATION_EXPORT_FIELD_MAP: Record<string, [string, (item: OperationLog) => unknown]> = {
  id: ['ID', (item) => item.id],
  username: ['用户名', (item) => item.username],
  module: ['模块', (item) => item.module],
  action: ['操作', (item) => item.action],
  method: ['方法', (item) => item.method],
  path: ['路径', (item) => item.path],
  target_id: ['目标ID', (item) => item.target_id || ''],
  status_code: ['状态码', (item) => (item.status_code !== null ? item.status_code : '')],
  ip: ['IP 地址', (item) => item.ip || ''],
  user_agent: ['User-Agent', (item) => item.user_agent || ''],
  payload: ['请求体', (item) => item.payload || ''],
  created_at: ['时间', (item) => formatDateTime(item.created_at)],
}

export const LOGIN_IMPORT_HEADER_MAP: Record<string, string> = {
  用户名: 'username',
  状态: 'status',
  'IP 地址': 'ip',
  'User-Agent': 'user_agent',
  说明: 'message',
  时间: 'created_at',
}

export const OPERATION_IMPORT_HEADER_MAP: Record<string, string> = {
  用户名: 'username',
  模块: 'module',
  操作: 'action',
  方法: 'method',
  路径: 'path',
  目标ID: 'target_id',
  状态码: 'status_code',
  'IP 地址': 'ip',
  'User-Agent': 'user_agent',
  请求体: 'payload',
  时间: 'created_at',
}

export const LOGIN_TEMPLATE_HEADERS = ['用户名', '状态', 'IP 地址', 'User-Agent', '说明', '时间']
export const LOGIN_TEMPLATE_ROWS = [['demo_user', 'success', '127.0.0.1', 'Mozilla/5.0', '导入示例', '2026-01-01 10:00:00']]

export const OPERATION_TEMPLATE_HEADERS = ['用户名', '模块', '操作', '方法', '路径', '目标ID', '状态码', 'IP 地址', 'User-Agent', '请求体', '时间']
export const OPERATION_TEMPLATE_ROWS = [
  ['demo_user', 'users', 'create', 'POST', '/api/admin/users', '', '200', '127.0.0.1', 'Mozilla/5.0', '{"username":"demo"}', '2026-01-01 10:00:00'],
]

export function parseIntOr(value: unknown, fallback = 0): number {
  try {
    return pyInt(value)
  } catch {
    return fallback
  }
}

export interface ErrorRow {
  line: number
  reason: string
  row: Record<string, string>
}

export function buildErrorRow(line: number, reason: string, row: Record<string, unknown>): ErrorRow {
  return {
    line,
    reason,
    row: Object.fromEntries(Object.entries(row ?? {}).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)])),
  }
}

const METHOD_ACTIONS: Record<string, string> = { POST: 'create', PUT: 'update', DELETE: 'delete' }

export function resolveModuleAndAction(path: string, method: string): { module: string; action: string } {
  const segments = path.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)
  let module = 'system'
  let action = METHOD_ACTIONS[method] ?? method.toLowerCase()

  if (segments.length >= 3 && segments[0] === 'api' && segments[1] === 'admin') {
    module = segments[2]!
    if (segments.includes('import')) action = 'import'
    else if (segments.includes('export')) action = 'export'
    else if (segments.includes('logout')) {
      module = 'auth'
      action = 'logout'
    } else if (segments.includes('change-password')) {
      module = 'auth'
      action = 'change_password'
    }
  }
  return { module, action }
}

// ---------------------------------------------------------------- parse_datetime

/**
 * 按 `fromisoformat` 规则解析 ISO 8601 日期时间的结果。
 * `offsetSeconds` 为 null 表示 naive；否则为带时区（秒，可含小数）。
 */
export interface ParsedDateTime {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  microsecond: number
  offsetMicros: number | null
}

class IsoError extends Error {}

const isDigit = (c: string | undefined) => c !== undefined && c >= '0' && c <= '9'

function parseDigits(s: string, pos: number, n: number): [number, number] {
  let value = 0
  for (let i = 0; i < n; i += 1) {
    const c = s[pos + i]
    if (!isDigit(c)) throw new IsoError('digit expected')
    value = value * 10 + (c!.charCodeAt(0) - 48)
  }
  return [value, pos + n]
}

function isLeap(y: number): boolean {
  return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)
}

const DAYS_IN_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const DAYS_BEFORE_MONTH = [0, 0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]

function daysInMonth(y: number, m: number): number {
  return m === 2 && isLeap(y) ? 29 : DAYS_IN_MONTH[m]!
}

function ymdToOrd(y: number, m: number, d: number): number {
  const py = y - 1
  return py * 365 + Math.floor(py / 4) - Math.floor(py / 100) + Math.floor(py / 400) + DAYS_BEFORE_MONTH[m]! + (m > 2 && isLeap(y) ? 1 : 0) + d
}

function ordToYmd(ordinal: number): [number, number, number] {
  let n = ordinal - 1
  const n400 = Math.floor(n / 146097)
  n %= 146097
  let year = n400 * 400 + 1
  const n100 = Math.floor(n / 36524)
  n %= 36524
  const n4 = Math.floor(n / 1461)
  n %= 1461
  const n1 = Math.floor(n / 365)
  n %= 365
  year += n100 * 100 + n4 * 4 + n1
  if (n1 === 4 || n100 === 4) return [year - 1, 12, 31]
  const leap = n1 === 3 && (n4 !== 24 || n100 === 3)
  let month = (n + 50) >> 5
  let preceding = DAYS_BEFORE_MONTH[month]! + (month > 2 && leap ? 1 : 0)
  if (preceding > n) {
    month -= 1
    preceding -= DAYS_IN_MONTH[month]! + (month === 2 && leap ? 1 : 0)
  }
  return [year, month, n - preceding + 1]
}

function isoWeekToYmd(year: number, week: number, day: number): [number, number, number] {
  if (year < 1 || year > 9999) throw new IsoError('Year is out of range')
  if (week <= 0 || week >= 53) {
    let outOfRange = true
    if (week === 53) {
      const firstWeekday = ymdToOrd(year, 1, 1) % 7
      if (firstWeekday === 4 || (firstWeekday === 3 && isLeap(year))) outOfRange = false
    }
    if (outOfRange) throw new IsoError('Invalid week')
  }
  if (day <= 0 || day >= 8) throw new IsoError('Invalid weekday')
  const firstDay = ymdToOrd(year, 1, 1)
  const firstWeekday = (firstDay + 6) % 7
  let week1Monday = firstDay - firstWeekday
  if (firstWeekday > 3) week1Monday += 7
  return ordToYmd(week1Monday + (week - 1) * 7 + (day - 1))
}

function findSeparator(s: string): number {
  const len = s.length
  if (len === 7) return 7
  if (s[4] === '-') {
    if (s[5] === 'W') {
      if (len < 8) throw new IsoError('Invalid ISO string')
      if (len > 8 && s[8] === '-') {
        if (len === 9) throw new IsoError('Invalid ISO string')
        if (len > 10 && isDigit(s[10])) return 8
        return 10
      }
      return 8
    }
    return 10
  }
  if (s[4] === 'W') {
    let idx = 7
    while (idx < len && isDigit(s[idx])) idx += 1
    if (idx < 9) return idx
    return idx % 2 === 0 ? 7 : 8
  }
  return 8
}

function parseDate(s: string, len: number): [number, number, number] {
  let [year, p] = parseDigits(s, 0, 4)
  const usesSep = s[p] === '-'
  if (usesSep) p += 1
  if (s[p] === 'W') {
    p += 1
    let week: number
    ;[week, p] = parseDigits(s, p, 2)
    let day = 1
    if (p < len) {
      if (usesSep) {
        if (s[p] !== '-') throw new IsoError('Inconsistent use of dash separator')
        p += 1
      }
      ;[day, p] = parseDigits(s, p, 1)
    }
    return isoWeekToYmd(year, week, day)
  }
  let month: number
  let day: number
  ;[month, p] = parseDigits(s, p, 2)
  if (usesSep) {
    if (s[p] !== '-') throw new IsoError('Inconsistent use of dash separator')
    p += 1
  }
  ;[day, p] = parseDigits(s, p, 2)
  return [year, month, day]
}

const FRACTION_CORRECTION = [100000, 10000, 1000, 100, 10]

/** C `parse_hh_mm_ss_ff`：返回 [时, 分, 秒, 微秒, 是否未到结尾] */
function parseHhMmSsFf(s: string, start: number, end: number): [number, number, number, number, boolean] {
  const vals = [0, 0, 0]
  let p = start
  let hasSep = true
  for (let i = 0; i < 3; i += 1) {
    ;[vals[i], p] = parseDigits(s, p, 2)
    const c = s[p]
    p += 1
    if (i === 0) hasSep = c === ':'
    // C: `if (p >= p_end) return c != '\0';`（c 可能是 end 处的时区符号或字符串结尾）
    if (p >= end) return [vals[0]!, vals[1]!, vals[2]!, 0, c !== undefined]
    if (hasSep && c === ':') continue
    if (c === '.' || c === ',') break
    if (!hasSep) p -= 1
    else throw new IsoError('Malformed time separator')
  }
  const remains = end - p
  const toParse = Math.min(remains, 6)
  let micro: number
  ;[micro, p] = parseDigits(s, p, toParse)
  if (toParse < 6) micro *= FRACTION_CORRECTION[toParse - 1] ?? 0
  while (isDigit(s[p])) p += 1
  return [vals[0]!, vals[1]!, vals[2]!, micro, s[p] !== undefined]
}

function parseTime(s: string, start: number): [number, number, number, number, number | null] {
  const end = s.length
  let tzPos = start
  do {
    const c = s[tzPos]
    if (c === 'Z' || c === '+' || c === '-') break
    tzPos += 1
  } while (tzPos < end)

  const [hour, minute, second, micro, more] = parseHhMmSsFf(s, start, tzPos)
  if (tzPos >= end) {
    if (more) throw new IsoError('Malformed time zone string')
    return [hour, minute, second, micro, null]
  }
  if (s[tzPos] === 'Z') {
    if (tzPos + 1 !== end) throw new IsoError('Malformed time zone string')
    return [hour, minute, second, micro, 0]
  }
  const sign = s[tzPos] === '-' ? -1 : 1
  let tz: [number, number, number, number, boolean]
  try {
    tz = parseHhMmSsFf(s, tzPos + 1, end)
  } catch {
    throw new IsoError('Malformed time zone string')
  }
  if (tz[4]) throw new IsoError('Malformed time zone string')
  const offsetMicros = sign * (((tz[0] * 60 + tz[1]) * 60 + tz[2]) * 1_000_000 + tz[3])
  return [hour, minute, second, micro, offsetMicros]
}

/** `datetime.fromisoformat(s)`；ValueError → null */
export function pyFromIsoFormat(s: string): ParsedDateTime | null {
  try {
    if (s.length < 7) throw new IsoError('too short')
    const sepLoc = findSeparator(s)
    const [year, month, day] = parseDate(s, sepLoc)
    let time: [number, number, number, number, number | null] = [0, 0, 0, 0, null]
    if (sepLoc < s.length) {
      // 分隔符可以是任意单个字符（按码点跳过）
      const sepChar = String.fromCodePoint(s.codePointAt(sepLoc)!)
      time = parseTime(s, sepLoc + sepChar.length)
    }
    const [hour, minute, second, microsecond, offsetMicros] = time
    if (year < 1 || year > 9999) return null
    if (month < 1 || month > 12) return null
    if (day < 1 || day > daysInMonth(year, month)) return null
    if (hour > 23 || minute > 59 || second > 59) return null
    if (offsetMicros !== null && Math.abs(offsetMicros) >= 86_400_000_000) return null
    return { year, month, day, hour, minute, second, microsecond, offsetMicros }
  } catch (err) {
    if (err instanceof IsoError) return null
    throw err
  }
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

/** naive 部分格式化为 PG timestamp 字面量 */
export function formatNaive(dt: ParsedDateTime): string {
  const base = `${pad(dt.year, 4)}-${pad(dt.month)}-${pad(dt.day)} ${pad(dt.hour)}:${pad(dt.minute)}:${pad(dt.second)}`
  return dt.microsecond ? `${base}.${pad(dt.microsecond, 6)}` : base
}

/**
 * `parse_datetime(raw, default)`：
 * - None / 空串 → 'default'（调用方用 utcnow）
 * - 解析失败 → null（调用方 `or datetime.utcnow()`）
 */
export function parseDatetime(raw: unknown): ParsedDateTime | 'default' | null {
  if (raw === null || raw === undefined) return 'default'
  const text = String(raw).trim()
  if (!text) return 'default'
  return pyFromIsoFormat(text.replaceAll('T', ' ').replaceAll('Z', ''))
}
