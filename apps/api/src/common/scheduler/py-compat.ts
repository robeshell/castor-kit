/**
 * 定时任务移植用到的 Python 字符串语义（str.strip / str.split / str.isdigit / int）。
 *
 * JS 的 trim() 与 \s 和 Python 的空白集合不完全相同（Python 含 \x1c-\x1f、\x85，不含 ﻿），
 * cron 表达式按空白切段，这里按 Python 的 str.isspace() 精确复刻。
 */

const PY_WHITESPACE = new Set(
  [
    '\t', '\n', '\x0b', '\x0c', '\r', '\x1c', '\x1d', '\x1e', '\x1f', ' ', '\x85', '\xa0', ' ',
    ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', ' ', '　',
  ],
)

export function pyIsSpace(ch: string): boolean {
  return PY_WHITESPACE.has(ch)
}

/** Python `text.strip()`（无参数） */
export function pyStrip(text: string): string {
  let start = 0
  let end = text.length
  while (start < end && PY_WHITESPACE.has(text[start]!)) start += 1
  while (end > start && PY_WHITESPACE.has(text[end - 1]!)) end -= 1
  return text.slice(start, end)
}

/** Python `text.split()`（无参数：按连续空白切分，丢弃首尾空串） */
export function pySplitWhitespace(text: string): string[] {
  const out: string[] = []
  let current = ''
  for (const ch of text) {
    if (PY_WHITESPACE.has(ch)) {
      if (current) out.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current) out.push(current)
  return out
}

const DECIMAL_DIGIT = /^\p{Nd}$/u

/**
 * Python `text.isdigit()`：非空且每个字符都是数字。
 * 覆盖 Unicode 十进制数字（Nd，如 '٣'），`int()` 能正确转换它们；
 * 上标等 Numeric_Type=Digit 字符（'²'）在 Python 里 isdigit() 为真但 int() 失败，这里按非数字处理。
 */
export function pyIsDigit(text: string): boolean {
  if (!text) return false
  for (const ch of text) {
    if (!DECIMAL_DIGIT.test(ch)) return false
  }
  return true
}

let digitTable: Map<number, number> | null = null

/**
 * 单个 Unicode 十进制数字字符的值。Unicode 保证 Nd 字符以 0-9 连续 10 个码位成组出现
 * （相邻组可能首尾相接，如数学字母数字符号区），所以按连续段每 10 个一组编号即可。
 */
function digitValue(ch: string): number {
  if (ch >= '0' && ch <= '9') return ch.charCodeAt(0) - 48
  if (!digitTable) {
    digitTable = new Map()
    let run = 0
    for (let cp = 0; cp <= 0x1fbff; cp += 1) {
      if (DECIMAL_DIGIT.test(String.fromCodePoint(cp))) {
        digitTable.set(cp, run % 10)
        run += 1
      } else {
        run = 0
      }
    }
  }
  return digitTable.get(ch.codePointAt(0)!) ?? 0
}

/** `int(text)`，前提是 `pyIsDigit(text)`（可带前导 '-'） */
export function pyIntFromDigits(text: string): number {
  const negative = text.startsWith('-')
  let value = 0
  for (const ch of negative ? text.slice(1) : text) value = value * 10 + digitValue(ch)
  return negative ? -value : value
}
