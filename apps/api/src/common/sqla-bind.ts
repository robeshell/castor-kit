/**
 * 把请求体里的原始 JSON 值写进列时，复刻 SQLAlchemy + psycopg2 的绑定语义。
 *
 * Python 代码里大量 `setattr(item, field, data[field])` / `Model(field=data.get(...))`，值不做类型转换直接落库：
 * - psycopg2 把 Python 值内联成 SQL 字面量，再由 PG 做赋值转换（`2.5` → integer 列四舍五入成 3，
 *   `True` → varchar 列存 'true'，`['a','b']` → varchar 列存 '{a,b}'），dict 无法适配直接报错；
 * - SQLAlchemy Boolean 列只接受 True/False/None/0/1，其余在 flush 时抛 TypeError。
 * node-pg 一律按文本参数发送，行为不同，所以这里先按 Python 语义把值转好（或抛 500）。
 * 所有错误在 Python 侧都落到 `except Exception → XxxServiceError(str(e), 500)` 或全局 500，
 * 对外都是通用 500 文案，因此这里统一抛 ServiceError(..., 500)。
 *
 * 目前 dicts / notification / announcement 共用；可考虑上移到 common/py.ts。
 */

import { ServiceError } from '@/common/errors'

function bindError(message: string): ServiceError {
  return new ServiceError(message, 500)
}

const PG_INT_MIN = -2_147_483_648
const PG_INT_MAX = 2_147_483_647

function pgArrayElement(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'boolean') return value ? 't' : 'f'
  if (typeof value === 'number') return String(value)
  const text = String(value)
  if (text === '' || /[{}",\\\s]/.test(text) || text.toUpperCase() === 'NULL') {
    return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  return text
}

/** psycopg2 把 list 适配成 ARRAY[...]，赋给文本列后 PG 输出数组文本（只支持元素同类型的一维数组） */
function pgArrayText(values: unknown[]): string {
  const kinds = new Set(values.filter((v) => v !== null && v !== undefined).map((v) => typeof v))
  if (kinds.size > 1 || [...kinds].some((k) => k === 'object')) throw bindError('cannot adapt list')
  return `{${values.map(pgArrayElement).join(',')}}`
}

/** 文本列（String / Text） */
export function bindText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) return pgArrayText(value)
  throw bindError("can't adapt type 'dict'")
}

/** 整数列（Integer）：非整数数值按 PG numeric → integer 赋值转换（四舍五入，远离零） */
export function bindInt(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    const n = Number.isInteger(value) ? value : Math.sign(value) * Math.round(Math.abs(value))
    if (n < PG_INT_MIN || n > PG_INT_MAX) throw bindError('integer out of range')
    return n
  }
  if (typeof value === 'string') {
    // PG integer 输入：允许首尾空白与正负号
    const text = value.trim()
    if (!/^[+-]?\d+$/.test(text)) throw bindError(`invalid input syntax for type integer: "${value}"`)
    const n = Number(text)
    if (n < PG_INT_MIN || n > PG_INT_MAX) throw bindError('integer out of range')
    return n
  }
  throw bindError('column is of type integer')
}

/** 布尔列（Boolean）：SQLAlchemy `_strict_as_bool` 只接受 None/True/False/0/1 */
export function bindBool(value: unknown): boolean | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return value
  if (value === 0 || value === 1) return value === 1
  throw bindError(`Not a boolean value: ${String(value)}`)
}

/**
 * 按主键/整数列查找时的原始值（`Model.query.get(raw)` / `filter(col == raw)`）：
 * 返回 null 表示“不可能匹配”（None、非整数数值），不合法的字符串/类型抛 500。
 */
export function lookupInt(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && !Number.isInteger(value)) return null
  return bindInt(value)
}

/**
 * SQLAlchemy 判断属性是否变化用的 Python `==`：数值与布尔按数值比较（`1 == True`），
 * 字符串逐字比较，其余类型互不相等。相等时 SQLAlchemy 不会把该列放进 UPDATE。
 */
export function pyEq(newValue: unknown, current: unknown): boolean {
  const a = newValue === undefined ? null : newValue
  const b = current === undefined ? null : current
  if (a === null || b === null) return a === b
  const numeric = (v: unknown) => typeof v === 'number' || typeof v === 'boolean'
  if (numeric(a) && numeric(b)) return Number(a) === Number(b)
  if (typeof a === 'string' && typeof b === 'string') return a === b
  return false
}

/** INSERT 时 SQLAlchemy 跳过值为 None 的列（让 `default=` 生效）：null → undefined */
export function omitNull<T>(value: T | null): T | undefined {
  return value === null ? undefined : value
}
