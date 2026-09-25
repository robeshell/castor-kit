/**
 * Python string semantics used by scheduled tasks (str.strip / str.split / str.isdigit / int).
 *
 * JS trim() and \s don't match Python's whitespace set exactly (Python includes \x1c-\x1f and \x85, excludes U+FEFF);
 * cron expressions are split on whitespace, so this replicates Python's str.isspace() exactly.
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

/** Python `text.strip()` (no arguments) */
export function pyStrip(text: string): string {
  let start = 0
  let end = text.length
  while (start < end && PY_WHITESPACE.has(text[start]!)) start += 1
  while (end > start && PY_WHITESPACE.has(text[end - 1]!)) end -= 1
  return text.slice(start, end)
}

/** Python `text.split()` (no arguments: split on runs of whitespace, drop leading/trailing empty strings) */
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
 * Python `text.isdigit()`: non-empty and every character is a digit.
 * Covers Unicode decimal digits (Nd, e.g. '٣'), which `int()` converts correctly;
 * Numeric_Type=Digit characters such as superscripts ('²') are isdigit() in Python but int() fails, so they are treated as non-digits here.
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
 * Value of a single Unicode decimal digit character. Unicode guarantees Nd characters come in contiguous runs of 10 code points (0-9)
 * (adjacent runs may abut, e.g. in Mathematical Alphanumeric Symbols), so numbering each contiguous run in groups of 10 is enough.
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

/** `int(text)`, assuming `pyIsDigit(text)` (an optional leading '-' is allowed) */
export function pyIntFromDigits(text: string): number {
  const negative = text.startsWith('-')
  let value = 0
  for (const ch of negative ? text.slice(1) : text) value = value * 10 + digitValue(ch)
  return negative ? -value : value
}
