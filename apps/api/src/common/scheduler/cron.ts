/**
 * 手写 5 段 cron 匹配器（分 时 日 月 周）：表达式解析 + 计算下一次执行时间。
 *
 * 与标准（Vixie）cron 的差异是有意为之，必须保留（已存任务的调度结果依赖这些规则）：
 * - “日”与“周”是 AND 关系（`0 0 1 * 1` = 既是 1 号又是周一），标准 cron 两者都受限时是 OR
 * - 周字段 Sunday=0，7 是 0 的别名（别名在区间两端分别生效，所以 `5-7` 是非法区间）
 * - 不支持 L / W / # / 月份与星期名称
 * - 按 UTC 逐分钟向前扫描，最多 366 天，找不到则报错
 *
 * 时间一律用“墙上时间”字段做整数运算，不经过 JS Date：输入是数据库 timestamp 文本
 * （`YYYY-MM-DD HH:mm:ss[.ffffff]`），输出是可直接写库的 `YYYY-MM-DD HH:mm:00`。
 */

import { pyStr, pyTruthy } from '@/common/py'
import { ScheduledTaskSchemaError } from './errors'
import { pyIntFromDigits, pyIsDigit, pySplitWhitespace, pyStrip } from './py-compat'

export interface CronSpec {
  text: string
  minutes: Set<number>
  hours: Set<number>
  days: Set<number>
  months: Set<number>
  weekdays: Set<number>
}

export function parseCronExpression(expression: unknown): CronSpec {
  // str(expression or '').strip()
  const text = pyStrip(pyTruthy(expression) ? pyStr(expression) : '')
  if (!text) throw new ScheduledTaskSchemaError('Cron 表达式不能为空')

  const fields = pySplitWhitespace(text)
  if (fields.length !== 5) throw new ScheduledTaskSchemaError('Cron 表达式格式错误，应为 5 段: 分 时 日 月 周')

  return {
    text,
    minutes: parseCronField(fields[0]!, 0, 59),
    hours: parseCronField(fields[1]!, 0, 23),
    days: parseCronField(fields[2]!, 1, 31),
    months: parseCronField(fields[3]!, 1, 12),
    weekdays: parseCronField(fields[4]!, 0, 6, new Map([[7, 0]])),
  }
}

function parseCronField(field: string, minValue: number, maxValue: number, alias: Map<number, number> = new Map()): Set<number> {
  const result = new Set<number>()

  for (const part of field.split(',')) {
    const token = pyStrip(part)
    if (!token) throw new ScheduledTaskSchemaError('Cron 表达式存在空字段')

    if (token === '*') {
      for (let v = minValue; v <= maxValue; v += 1) result.add(v)
      continue
    }

    let step = 1
    let base = token
    const slash = token.indexOf('/')
    if (slash >= 0) {
      base = token.slice(0, slash)
      const stepRaw = token.slice(slash + 1)
      if (!pyIsDigit(stepRaw) || pyIntFromDigits(stepRaw) <= 0) {
        throw new ScheduledTaskSchemaError(`Cron 步长不合法: ${token}`)
      }
      step = pyIntFromDigits(stepRaw)
    }

    let start: number
    let end: number
    const dash = base.indexOf('-')
    if (base === '*') {
      start = minValue
      end = maxValue
    } else if (dash >= 0) {
      start = parseNum(base.slice(0, dash), minValue, maxValue, alias)
      end = parseNum(base.slice(dash + 1), minValue, maxValue, alias)
      if (start > end) throw new ScheduledTaskSchemaError(`Cron 区间不合法: ${token}`)
    } else {
      start = parseNum(base, minValue, maxValue, alias)
      end = start
    }

    for (let v = start; v <= end; v += step) result.add(v)
  }

  if (result.size === 0) throw new ScheduledTaskSchemaError('Cron 字段解析后为空')
  return result
}

/** 规范化整数文本：去掉前导 0、Unicode 数字转 ASCII（大数也保持精确文本） */
function canonicalIntText(text: string): string {
  const negative = text.startsWith('-')
  let digits = ''
  for (const ch of negative ? text.slice(1) : text) digits += String(Math.abs(pyIntFromDigits(ch)))
  digits = digits.replace(/^0+(?=\d)/, '')
  return negative && digits !== '0' ? `-${digits}` : digits
}

function parseNum(raw: string, minValue: number, maxValue: number, alias: Map<number, number>): number {
  const text = pyStrip(raw)
  if (!text || (text[0] === '-' && !pyIsDigit(text.slice(1))) || (text[0] !== '-' && !pyIsDigit(text))) {
    throw new ScheduledTaskSchemaError(`Cron 数值不合法: ${raw}`)
  }

  const canonical = canonicalIntText(text)
  let value = Number(canonical)
  value = alias.get(value) ?? value
  if (value < minValue || value > maxValue) {
    const shown = Number.isSafeInteger(value) ? String(value) : canonical
    throw new ScheduledTaskSchemaError(`Cron 数值超出范围: ${shown}`)
  }
  return value
}

// ---- 墙上时间（UTC）整数运算 ----

export interface WallTime {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  microsecond: number
}

const TIMESTAMP_RE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?$/

/** 解析数据库 timestamp 文本（驱动原样返回的 `YYYY-MM-DD HH:mm:ss[.ffffff]`，或 isoformat 的 `T` 分隔） */
export function parseTimestamp(text: string): WallTime {
  const m = TIMESTAMP_RE.exec(text.trim())
  if (!m) throw new Error(`无法解析时间：${text}`)
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: Number(m[4]),
    minute: Number(m[5]),
    second: Number(m[6] ?? 0),
    microsecond: Number((m[7] ?? '').padEnd(6, '0') || 0),
  }
}

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeap(year) ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

/** 1970-01-01 起的天数（proleptic Gregorian，Howard Hinnant days_from_civil） */
export function daysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year
  const era = Math.floor(y / 400)
  const yoe = y - era * 400
  const mp = (month + 9) % 12
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}

/** 墙上时间 → 1970 起的微秒数（用于两个数据库时间求差） */
export function toEpochMicros(t: WallTime): number {
  const days = daysFromCivil(t.year, t.month, t.day)
  return ((days * 24 + t.hour) * 60 + t.minute) * 60_000_000 + t.second * 1_000_000 + t.microsecond
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0')
}

/** 格式化为可写库的 timestamp 文本（秒为 0，无小数） */
function formatMinute(year: number, month: number, day: number, hour: number, minute: number): string {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:00`
}

/** 默认的前瞻窗口：366 天 */
export const LOOKAHEAD_MINUTES = 366 * 24 * 60

/**
 * 从 baseTime（数据库 UTC timestamp 文本）之后的下一分钟开始逐分钟扫描，返回第一个匹配时刻。
 * 返回值是 `YYYY-MM-DD HH:mm:00` 文本（可直接写库，读出后经 toIso 输出）。
 */
export function computeNextRunAt(expression: unknown, baseTime: string, lookaheadMinutes = LOOKAHEAD_MINUTES): string {
  const cron = parseCronExpression(expression)
  const base = parseTimestamp(baseTime)

  // current = base.replace(second=0, microsecond=0) + timedelta(minutes=1)
  let { year, month, day, hour, minute } = base
  // cron 周：Monday=1 ... Sunday=0；1970-01-01 是周四（4）
  let weekday = (((daysFromCivil(year, month, day) + 4) % 7) + 7) % 7
  let monthDays = daysInMonth(year, month)

  const advance = () => {
    minute += 1
    if (minute < 60) return
    minute = 0
    hour += 1
    if (hour < 24) return
    hour = 0
    weekday = (weekday + 1) % 7
    day += 1
    if (day <= monthDays) return
    day = 1
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
    monthDays = daysInMonth(year, month)
  }

  advance()
  for (let i = 0; i < lookaheadMinutes; i += 1) {
    if (
      cron.minutes.has(minute) &&
      cron.hours.has(hour) &&
      cron.days.has(day) &&
      cron.months.has(month) &&
      cron.weekdays.has(weekday)
    ) {
      return formatMinute(year, month, day, hour, minute)
    }
    advance()
  }

  throw new ScheduledTaskSchemaError('Cron 表达式在一年内没有可触发时间，请检查配置')
}
