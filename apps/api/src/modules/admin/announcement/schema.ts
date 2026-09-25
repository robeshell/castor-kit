/**
 * 公告管理 schema 层：字段映射与归一化
 */

import { ServiceError } from '@/common/errors'
import { isPlainObject, pyTruthy } from '@/common/py'
import { formatDateTime } from '@/common/serialize'
import type { Announcement } from '@/db/schema'

export const EXPORT_FIELD_MAP: Record<string, [string, (item: Announcement) => unknown]> = {
  id: ['ID', (item) => item.id],
  title: ['标题', (item) => item.title || ''],
  announce_type: ['公告类型', (item) => item.announce_type || ''],
  status: ['状态', (item) => item.status || ''],
  is_top: ['是否置顶', (item) => (item.is_top ? '是' : '否')],
  sort_order: ['排序权重', (item) => item.sort_order ?? 0],
  content: ['内容', (item) => item.content || ''],
  publish_at: ['发布时间', (item) => formatDateTime(item.publish_at)],
  created_at: ['创建时间', (item) => formatDateTime(item.created_at)],
}

export const IMPORT_HEADER_MAP: Record<string, string> = {
  标题: 'title',
  公告类型: 'announce_type',
  状态: 'status',
  是否置顶: 'is_top',
  排序权重: 'sort_order',
  内容: 'content',
  title: 'title',
  announce_type: 'announce_type',
  status: 'status',
  is_top: 'is_top',
  sort_order: 'sort_order',
  content: 'content',
}

export const TEMPLATE_HEADERS = ['标题', '公告类型', '状态', '是否置顶', '排序权重', '内容']
export const TEMPLATE_ROWS = [['系统维护公告', 'system', 'draft', '否', '0', '系统将于今晚进行维护，请提前保存工作。']]

export const ANNOUNCE_TYPES = ['system', 'activity', 'update']
export const STATUSES = ['draft', 'published']

function pyTypeName(value: unknown): string {
  if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'float'
  if (typeof value === 'boolean') return 'bool'
  if (Array.isArray(value)) return 'list'
  return 'dict'
}

/**
 * `(value or '').strip()`：假值 → ''；真值必须是字符串，
 * 否则抛错（未捕获 → 全局 500）。
 */
export function stripOrEmpty(value: unknown): string {
  if (!pyTruthy(value)) return ''
  if (typeof value !== 'string') throw new ServiceError(`'${pyTypeName(value)}' object has no attribute 'strip'`, 500)
  return value.trim()
}

/**
 * `data.get('fields') or []` 后 `[f for f in fields if f in EXPORT_FIELD_MAP]`：
 * 字符串按字符迭代、dict 按键迭代；不可迭代或含不可哈希元素（list/dict）时抛错 → 500。
 */
export function pickExportFields(raw: unknown): string[] {
  if (!pyTruthy(raw)) return []
  let candidates: unknown[]
  if (typeof raw === 'string') candidates = [...raw]
  else if (Array.isArray(raw)) candidates = raw
  else if (isPlainObject(raw)) candidates = Object.keys(raw)
  else throw new ServiceError(`'${pyTypeName(raw)}' object is not iterable`, 500)
  const result: string[] = []
  for (const f of candidates) {
    if (Array.isArray(f) || isPlainObject(f)) throw new ServiceError('unhashable type', 500)
    if (typeof f === 'string' && Object.hasOwn(EXPORT_FIELD_MAP, f)) result.push(f)
  }
  return result
}

/**
 * `id IN (ids)`：ids 必须是 list（或 dict，取键）；元素按 SQL 字面量比较 ——
 * 整数 / 可解析的数字字符串参与匹配，非整数数值与 None 永不匹配，其余（bool、不合法字符串、嵌套）PG 报错 → 500。
 */
export function idsForInClause(ids: unknown): number[] {
  // dict 可迭代（迭代键），str 与标量不是合法的 IN 列表
  const values = Array.isArray(ids) ? ids : isPlainObject(ids) ? Object.keys(ids) : null
  if (!values) throw new ServiceError('IN expression list expected', 500)
  const result: number[] = []
  for (const v of values) {
    if (v === null) continue
    if (typeof v === 'number') {
      if (Number.isInteger(v)) result.push(v)
      continue
    }
    if (typeof v === 'string' && /^\s*[+-]?\d+\s*$/.test(v)) {
      const n = Number(v.trim())
      if (n < -2_147_483_648 || n > 2_147_483_647) throw new ServiceError('integer out of range', 500)
      result.push(n)
      continue
    }
    throw new ServiceError('invalid IN element', 500)
  }
  return result
}

// ---------------------------------------------------------------- datetime.fromisoformat

/**
 * `datetime.fromisoformat(s)` 的解析结果。
 * text 用于写库：naive 为 `YYYY-MM-DD HH:MM:SS.ffffff`（按 timestamp 存），
 * aware 为带偏移的 ISO 串（以 `::timestamptz` 发送，存入 timestamp 列时换算到会话时区）。
 */
export interface PyDateTime {
  text: string
  aware: boolean
}

const isDigit = (c: string | undefined) => c !== undefined && c >= '0' && c <= '9'

function digits(s: string, start: number, len: number): number {
  const part = s.slice(start, start + len)
  if (part.length !== len || ![...part].every(isDigit)) throw new Error('invalid digits')
  return Number(part)
}

function isLeap(y: number): boolean {
  return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)
}

function daysInMonth(y: number, m: number): number {
  return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]!
}

/** 纯日历运算（非数据库时间）：ISO 周日期 → 公历 */
function isoWeekToGregorian(year: number, week: number, day: number): [number, number, number] {
  if (year < 1 || year > 9999) throw new Error('year out of range')
  const jan1 = new Date(0)
  jan1.setUTCFullYear(year, 0, 1)
  const jan1Weekday = jan1.getUTCDay() === 0 ? 7 : jan1.getUTCDay() // 1=Mon..7=Sun
  if (!(week > 0 && week < 53)) {
    const ok = week === 53 && (jan1Weekday === 4 || (jan1Weekday === 3 && isLeap(year)))
    if (!ok) throw new Error('invalid week')
  }
  if (!(day > 0 && day < 8)) throw new Error('invalid weekday')
  // 第 1 周的周一
  const week1Monday = new Date(jan1.getTime())
  week1Monday.setUTCDate(jan1.getUTCDate() - (jan1Weekday - 1) + (jan1Weekday > 4 ? 7 : 0))
  const target = new Date(week1Monday.getTime())
  target.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7 + (day - 1))
  return [target.getUTCFullYear(), target.getUTCMonth() + 1, target.getUTCDate()]
}

function findSeparator(s: string): number {
  const len = s.length
  if (len === 7) return 7
  if (s[4] === '-') {
    if (s[5] === 'W') {
      if (len > 8 && s[8] === '-') {
        if (len === 9) throw new Error('invalid')
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

function parseDate(s: string): [number, number, number] {
  if (![7, 8, 10].includes(s.length)) throw new Error('invalid date length')
  const year = digits(s, 0, 4)
  const hasSep = s[4] === '-'
  let pos = 4 + (hasSep ? 1 : 0)
  if (s[pos] === 'W') {
    pos += 1
    const week = digits(s, pos, 2)
    pos += 2
    let day = 1
    if (s.length > pos) {
      if ((s[pos] === '-') !== hasSep) throw new Error('inconsistent dash')
      pos += hasSep ? 1 : 0
      day = digits(s, pos, 1)
      pos += 1
    }
    if (pos !== s.length) throw new Error('trailing')
    return isoWeekToGregorian(year, week, day)
  }
  const month = digits(s, pos, 2)
  pos += 2
  if ((s[pos] === '-') !== hasSep) throw new Error('inconsistent dash')
  pos += hasSep ? 1 : 0
  const day = digits(s, pos, 2)
  pos += 2
  if (pos !== s.length) throw new Error('trailing')
  return [year, month, day]
}

/** HH[:?MM[:?SS[{.,}f+]]] → [h, m, s, us] */
function parseHhMmSsFf(s: string): [number, number, number, number] {
  const comps: [number, number, number, number] = [0, 0, 0, 0]
  let pos = 0
  let hasSep = false
  for (let comp = 0; comp < 3; comp += 1) {
    if (s.length - pos < 2) throw new Error('incomplete time')
    comps[comp] = digits(s, pos, 2)
    pos += 2
    const next = s[pos]
    if (comp === 0) hasSep = next === ':'
    if (next === undefined || comp >= 2) break
    if (hasSep && next !== ':') throw new Error('invalid time separator')
    pos += hasSep ? 1 : 0
  }
  if (pos < s.length) {
    if (s[pos] !== '.' && s[pos] !== ',') throw new Error('invalid microsecond separator')
    pos += 1
    const remainder = s.length - pos
    const toParse = Math.min(remainder, 6)
    if (toParse === 0) throw new Error('empty fraction')
    comps[3] = digits(s, pos, toParse) * 10 ** (6 - toParse)
    if (![...s.slice(pos + toParse)].every(isDigit)) throw new Error('non-digit fraction')
  }
  return comps
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

/** 按 `fromisoformat` 规则解析 ISO 8601 日期时间（不支持 24:00）；不合法返回 null */
export function pyFromIsoformat(value: string): PyDateTime | null {
  try {
    if (value.length < 7) return null
    const sepAt = findSeparator(value)
    const [year, month, day] = parseDate(value.slice(0, sepAt))
    // 有分隔符就必须带时间部分（`2026-01-02T` 不合法）
    if (sepAt < value.length && sepAt + 1 >= value.length) return null
    const tstr = value.slice(sepAt + 1)

    let [hour, minute, second, micro] = [0, 0, 0, 0]
    let offset: string | null = null
    if (tstr) {
      if (tstr.length < 2) return null
      const candidates = [tstr.indexOf('-'), tstr.indexOf('+'), tstr.indexOf('Z')]
      const tzIdx = candidates.find((i) => i >= 0) ?? -1
      const timestr = tzIdx >= 0 ? tstr.slice(0, tzIdx) : tstr
      ;[hour, minute, second, micro] = parseHhMmSsFf(timestr)

      if (tzIdx >= 0 && tzIdx === tstr.length - 1 && tstr.endsWith('Z')) {
        offset = '+00:00'
      } else if (tzIdx >= 0) {
        const tzstr = tstr.slice(tzIdx + 1)
        if ([0, 1, 3].includes(tzstr.length)) return null
        const [th, tm, ts, tus] = parseHhMmSsFf(tzstr)
        const sign = tstr[tzIdx] === '-' ? '-' : '+'
        const totalUs = ((th * 60 + tm) * 60 + ts) * 1_000_000 + tus
        if (totalUs >= 24 * 3600 * 1_000_000) return null
        if (totalUs === 0) offset = '+00:00'
        else {
          offset = `${sign}${pad(th)}:${pad(tm)}`
          if (ts || tus) offset += `:${pad(ts)}`
          if (tus) offset += `.${pad(tus, 6)}`
        }
      }

    }

    if (year < 1 || year > 9999 || month < 1 || month > 12) return null
    if (day < 1 || day > daysInMonth(year, month)) return null
    if (hour > 23 || minute > 59 || second > 59) return null

    const text = `${pad(year, 4)}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}.${pad(micro, 6)}`
    return offset ? { text: `${text}${offset}`, aware: true } : { text, aware: false }
  } catch {
    return null
  }
}

/** 把 `Z` 替换成 `+00:00` 后按 `fromisoformat` 规则解析；非字符串与解析失败都返回 null */
export function parsePublishAt(value: unknown): PyDateTime | null {
  if (typeof value !== 'string') return null
  return pyFromIsoformat(value.replace(/Z/g, '+00:00'))
}

/** 数据库 timestamp 文本 → 与 PyDateTime.text 同格式（用于 naive datetime 的相等比较） */
export function normalizeDbTimestamp(value: string | null): string | null {
  if (!value) return null
  const [datePart, timePart = '00:00:00'] = value.replace('T', ' ').split(' ')
  const [hms, frac = ''] = timePart.split('.')
  return `${datePart} ${hms}.${frac.padEnd(6, '0')}`
}
