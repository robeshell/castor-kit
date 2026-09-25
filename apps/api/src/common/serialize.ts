/**
 * 时间输出格式：`YYYY-MM-DDTHH:mm:ss[.ffffff]`，无 `Z`，UTC 值，
 * 微秒为 0 时不带小数部分（变长格式）。
 *
 * 数据库里的 timestamp 由驱动原样返回文本（见 db/client.ts 的类型解析器与 schema 的 mode:'string'），
 * `toIso()` 只做两件事，不经过 JS `Date`（时区与微秒精度问题）：
 * - 日期与时间之间的空格换成 `T`
 * - 小数秒右补 0 到 6 位：PostgreSQL 文本输出会去掉末尾的 0（`.68794`），接口固定输出 6 位（`.687940`）
 * 禁止在响应里使用 `Date#toISOString()`。
 */

export function toIso(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  return value.replace(' ', 'T').replace(/\.(\d{1,5})$/, (_, frac: string) => `.${frac.padEnd(6, '0')}`)
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0')
}

/**
 * 应用侧生成的当前 UTC 时间，格式同 toIso()。
 * JS 只有毫秒精度，微秒部分补 000；毫秒为 0 时省略小数。
 */
export function utcNowIso(now: Date = new Date()): string {
  const base =
    `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`
  const ms = now.getUTCMilliseconds()
  return ms === 0 ? base : `${base}.${pad(ms, 3)}000`
}

/** 格式化为 `YYYY-MM-DD HH:mm:ss`（输入为数据库原样返回的 timestamp 文本），空值返回 '' */
export function formatDateTime(value: string | null | undefined): string {
  return value ? value.replace('T', ' ').slice(0, 19) : ''
}

/** 格式化为 `YYYY-MM-DD`，空值返回 '' */
export function formatDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : ''
}
