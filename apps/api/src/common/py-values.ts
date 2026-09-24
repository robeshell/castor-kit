/**
 * SQLAlchemy + psycopg2 写库/查询时对“宽松请求体取值”的实际处理，在 Node 侧复刻（roles / menu / logs 共用）。
 *
 * Flask 版把 `request.get_json()` 里的原始值直接赋给模型字段或拼进 `Model.id.in_(...)`，最终效果由
 * SQLAlchemy 类型处理 + psycopg2 字面量渲染 + PostgreSQL 赋值转换共同决定（均已对 Flask 实测）：
 * - 文本列：str 原样；int/float → 数字文本；bool → 'true'/'false'；list → PG 数组文本（如 `{1,2}`）；dict → 500
 * - 整数列：int 原样；float → 四舍五入（远离 0）；str → PG int4 解析（非法 → 500）；bool/list/dict → 500
 * - 布尔列：SQLAlchemy 严格校验，只接受 None/True/False/0/1，其余 → 500
 * - `id IN (...)`：参数必须是 list（dict 取键），元素 int 超出 int4 范围或非整数 float 只是“不匹配”，
 *   str 交给 int4 解析（非法 → 500），None 不匹配，bool/list/dict → 500
 * Python 侧这些错误要么被 service 的 `except Exception` 转成 500，要么是未捕获异常（Flask 同样 500），
 * 这里统一抛 `ServiceError(..., 500)`，由全局错误处理器输出通用文案。
 */

import { ServiceError } from '@/common/errors'
import { isPlainObject, pyStr, pyTruthy } from '@/common/py'
import { normalizeTableFileType, type TableFileType } from '@/common/tabular'

const INT4_MIN = -2_147_483_648
const INT4_MAX = 2_147_483_647
/** PostgreSQL int4in 接受的首尾空白（isspace） */
const PG_INT_RE = /^[ \t\n\r\v\f]*([+-]?\d+)[ \t\n\r\v\f]*$/

/** Python 侧会抛异常（TypeError / AttributeError / 数据库错误）的输入 → 500 */
export function internalError(detail: string): ServiceError {
  return new ServiceError(detail, 500)
}

/** 数据库执行错误（含 drizzle 包装的 cause 链）是否提到某个约束/关键字，等价 `'menus_pkey' in str(e)` */
export function dbErrorMentions(err: unknown, needle: string): boolean {
  let cur: unknown = err
  for (let depth = 0; cur && depth < 5; depth += 1) {
    const e = cur as { message?: unknown; constraint?: unknown; cause?: unknown }
    if (e.constraint === needle) return true
    if (typeof e.message === 'string' && e.message.includes(needle)) return true
    cur = e.cause
  }
  return false
}

/** Python `for x in value`（list 元素 / dict 键 / str 字符），其他类型不可迭代 → 500 */
export function pyIterate(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') return [...value]
  if (isPlainObject(value)) return Object.keys(value)
  throw internalError(`'${typeof value}' object is not iterable`)
}

/** Python `==`（只覆盖 JSON 值与数据库标量）：bool 与数字按数值比较，其余同类型严格相等 */
export function pyEq(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined || b === null || b === undefined) {
    return (a === null || a === undefined) && (b === null || b === undefined)
  }
  const numLike = (v: unknown) => typeof v === 'number' || typeof v === 'boolean'
  if (numLike(a) && numLike(b)) return Number(a) === Number(b)
  if (typeof a === 'string' && typeof b === 'string') return a === b
  return false
}

function parsePgInt(text: string): number {
  const m = PG_INT_RE.exec(text)
  if (!m) throw internalError(`invalid input syntax for type integer: "${text}"`)
  const n = Number(m[1])
  if (n < INT4_MIN || n > INT4_MAX) throw internalError(`value "${text}" is out of range for type integer`)
  return n
}

/** PG numeric → text 的十进制输出（不含指数） */
function numberText(value: number): string {
  if (Number.isInteger(value)) return BigInt(value).toString()
  const text = String(value)
  if (!/e/i.test(text)) return text
  const [mantissa, expRaw] = text.toLowerCase().split('e') as [string, string]
  const exp = Number(expRaw)
  const negative = mantissa.startsWith('-')
  const [intPart, fracPart = ''] = mantissa.replace('-', '').split('.') as [string, string?]
  const digits = intPart + fracPart
  const point = intPart.length + exp
  let out: string
  if (point <= 0) out = `0.${'0'.repeat(-point)}${digits}`
  else if (point >= digits.length) out = digits + '0'.repeat(point - digits.length)
  else out = `${digits.slice(0, point)}.${digits.slice(point)}`
  return (negative ? '-' : '') + out
}

/** PG array_out 的元素引用规则 */
function arrayElementText(text: string): string {
  const needsQuote = text === '' || /^null$/i.test(text) || /[{}",\\ \t\n\r\v\f]/.test(text)
  return needsQuote ? `"${text.replace(/(["\\])/g, '\\$1')}"` : text
}

/** psycopg2 把 list 渲染成 `ARRAY[...]`，赋给文本列后 PG 输出的数组文本 */
function pgArrayText(items: unknown[]): string {
  const kinds = new Set(items.filter((v) => v !== null && v !== undefined).map((v) => typeof v))
  if (kinds.size > 1 || [...kinds].some((k) => !['string', 'number', 'boolean'].includes(k))) {
    throw internalError('cannot adapt list value')
  }
  const parts = items.map((v) => {
    if (v === null || v === undefined) return 'NULL'
    if (typeof v === 'boolean') return v ? 't' : 'f'
    if (typeof v === 'number') return numberText(v)
    return arrayElementText(v as string)
  })
  return `{${parts.join(',')}}`
}

/** 赋给 varchar/text 列的值 */
export function adaptText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return numberText(value)
  if (Array.isArray(value)) return pgArrayText(value)
  throw internalError("can't adapt type 'dict'")
}

/** 赋给 integer 列的值 */
export function adaptInt(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    const n = Number.isInteger(value) ? value : Math.sign(value) * Math.round(Math.abs(value))
    if (n < INT4_MIN || n > INT4_MAX) throw internalError('integer out of range')
    return n
  }
  if (typeof value === 'string') return parsePgInt(value)
  throw internalError(`column is of type integer but expression is of type ${typeof value}`)
}

/** 赋给 boolean 列的值（SQLAlchemy Boolean 严格校验） */
export function adaptBool(value: unknown): boolean | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return value
  if (value === 0) return false
  if (value === 1) return true
  throw internalError(`Value ${pyStr(value)} is not None, True, or False`)
}

/** 等价 `Model.id.in_(values)`：返回可安全用于 inArray 的整数 id（可能为空数组 = 不匹配任何行） */
export function adaptIdsForIn(values: unknown): number[] {
  let items: unknown[]
  if (Array.isArray(values)) items = values
  else if (isPlainObject(values)) items = Object.keys(values)
  else throw internalError('IN expression list, SELECT construct, or bound parameter object expected')

  const out: number[] = []
  for (const v of items) {
    if (v === null || v === undefined) continue
    if (typeof v === 'number') {
      if (Number.isInteger(v) && v >= INT4_MIN && v <= INT4_MAX) out.push(v)
      continue
    }
    if (typeof v === 'string') {
      out.push(parsePgInt(v))
      continue
    }
    throw internalError('operator does not exist: integer = <non-integer>')
  }
  return [...new Set(out)]
}

/** `filters.get(key)`：filters 不是 dict 时 Python 抛 AttributeError → 500 */
export function dictGet(obj: unknown, key: string): unknown {
  if (!isPlainObject(obj)) throw internalError(`'${typeof obj}' object has no attribute 'get'`)
  return obj[key]
}

export interface ExportArgs {
  ids: unknown
  exportMode: string
  filters: unknown
  fileType: TableFileType
  validFields: string[]
}

/**
 * 各模块 export_xxx 的公共前半段：
 * ```py
 * ids = data.get('ids') or []
 * fields = data.get('fields') or []
 * export_mode = (data.get('export_mode') or 'selected').strip()
 * filters = data.get('filters') or {}
 * file_type = normalize_table_file_type(data.get('file_type'), default='csv')
 * valid_fields = [field for field in fields if field in EXPORT_FIELD_MAP] or list(EXPORT_FIELD_MAP.keys())
 * ```
 */
export function parseExportArgs(data: Record<string, unknown>, fieldMap: Record<string, unknown>): ExportArgs {
  const ids = pyTruthy(data.ids) ? data.ids : []
  const fields = pyTruthy(data.fields) ? data.fields : []
  const modeRaw = pyTruthy(data.export_mode) ? data.export_mode : 'selected'
  if (typeof modeRaw !== 'string') throw internalError("object has no attribute 'strip'")
  const filters = pyTruthy(data.filters) ? data.filters : {}
  const fileType = normalizeTableFileType(pyTruthy(data.file_type) ? pyStr(data.file_type) : '')

  const validFields: string[] = []
  for (const field of pyIterate(fields)) {
    if (field !== null && typeof field === 'object') throw internalError('unhashable type')
    if (typeof field === 'string' && Object.hasOwn(fieldMap, field)) validFields.push(field)
  }
  return {
    ids,
    exportMode: modeRaw.trim(),
    filters,
    fileType,
    validFields: validFields.length > 0 ? validFields : Object.keys(fieldMap),
  }
}

/** 选中导出模式：`if not isinstance(ids, list) or not ids` */
export function selectedIdsOrNull(ids: unknown): unknown[] | null {
  return Array.isArray(ids) && ids.length > 0 ? ids : null
}

/**
 * `request.get_json() or {}` 之后按 dict 使用（`data.get(...)`）：
 * 假值（null / [] / 0 / '' / false）→ {}；其他非 dict 的真值在 Python 里 `.get` 抛 AttributeError → 500。
 * （common/http.jsonBody 把所有非对象都当作 {}，这里按 Flask 实测行为收紧。）
 */
export function dictBody(raw: unknown): Record<string, unknown> {
  if (isPlainObject(raw)) return raw
  if (!pyTruthy(raw)) return {}
  throw internalError("object has no attribute 'get'")
}

/**
 * 只用 `'key' in data` 访问的处理器（update_role）：list 的 `in` 判断恒为 False（等价 {}）；
 * str 的 `in` 是子串判断，命中后 `data[key]` 抛 TypeError；数字 / bool 的 `in` 直接 TypeError。
 */
export function membershipBody(raw: unknown, keys: readonly string[]): Record<string, unknown> {
  if (isPlainObject(raw)) return raw
  if (!pyTruthy(raw) || Array.isArray(raw)) return {}
  if (typeof raw === 'string' && !keys.some((k) => raw.includes(k))) return {}
  throw internalError('argument of type is not iterable')
}
