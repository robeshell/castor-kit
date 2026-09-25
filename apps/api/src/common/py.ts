/**
 * Python 语义的基础工具：在 service/schema 里按 Python `str()` / `int()` / `float()` / 真值判断的规则转换值，
 * 避免 JS 的隐式转换悄悄改变边缘输入的行为。各模块自己的 parse_bool/parse_int 等在模块 schema.ts 里
 * 各自实现（不同模块接受的取值不完全一样，不要合并）。
 */

/** Python 真值：None / '' / 0 / False / 空 list / 空 dict 为假 */
export function pyTruthy(value: unknown): boolean {
  if (value === null || value === undefined || value === false || value === 0 || value === '') return false
  if (typeof value === 'number' && Number.isNaN(value)) return true
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value as object).length > 0
  return true
}

function pyRepr(value: unknown): string {
  if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  return pyStr(value)
}

/** 等价 Python `str(value)`（覆盖 JSON 可表达的类型；JSON 里的 1.0 在 JS 已是 1，无法区分） */
export function pyStr(value: unknown): string {
  if (value === null || value === undefined) return 'None'
  if (value === true) return 'True'
  if (value === false) return 'False'
  if (typeof value === 'string') return value
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'nan'
    if (!Number.isFinite(value)) return value > 0 ? 'inf' : '-inf'
    return String(value)
  }
  if (Array.isArray(value)) return `[${value.map(pyRepr).join(', ')}]`
  if (typeof value === 'object') {
    return `{${Object.entries(value as object)
      .map(([k, v]) => `${pyRepr(k)}: ${pyRepr(v)}`)
      .join(', ')}}`
  }
  return String(value)
}

/** Python `str(x or '').strip()`：假值 → ''，其余转字符串后去首尾空白 */
export function pyStrOrEmpty(value: unknown): string {
  return pyTruthy(value) ? pyStr(value).trim() : ''
}

/** Python `.strip()`（去除首尾空白，含全角空格等 Unicode 空白） */
export function pyStrip(text: string): string {
  return text.trim()
}

export class PyValueError extends Error {}

/**
 * 等价 Python `int(value)`：
 * - bool → 0/1；数值 → 向零截断
 * - 字符串 → 允许首尾空白、正负号、下划线分组，不允许小数点
 * - 其他（None、list、dict、非法字符串）抛 PyValueError（Python 是 TypeError/ValueError）
 */
export function pyInt(value: unknown): number {
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new PyValueError(`cannot convert ${value} to integer`)
    return Math.trunc(value)
  }
  if (typeof value === 'string') {
    const text = value.trim()
    if (/^[+-]?\d+(_\d+)*$/.test(text)) return Number.parseInt(text.replace(/_/g, ''), 10)
  }
  throw new PyValueError(`invalid literal for int(): ${pyRepr(value)}`)
}

/** 等价 Python `float(value)` */
export function pyFloat(value: unknown): number {
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase().replace(/_/g, '')
    if (/^[+-]?(nan)$/.test(text)) return Number.NaN
    if (/^[+-]?(inf|infinity)$/.test(text)) return text.startsWith('-') ? -Infinity : Infinity
    if (/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/.test(text)) return Number.parseFloat(text)
  }
  throw new PyValueError(`could not convert to float: ${pyRepr(value)}`)
}

/** `isinstance(value, dict)` */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
