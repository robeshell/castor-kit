/**
 * PostgreSQL constraint / data errors → 400 business errors.
 *
 * Unique violations, over-long values, numeric overflow and the like are caused by user input; they must not become 500s or leak raw pg messages to the frontend.
 * Scaffold-generated services call this inside their transaction wrapper; other errors return null and the caller treats them as 500.
 */

import { ServiceError } from './errors'

interface PgErrorLike {
  code: string
  constraint?: string
  column?: string
}

const MESSAGES: Record<string, string> = {
  '23505': '数据重复：唯一字段的值已存在',
  '23502': '必填字段不能为空',
  '23503': '关联的数据不存在或仍被引用',
  '23514': '数据不符合约束条件',
  '22001': '字段长度超出限制',
  '22003': '数值超出范围',
  '22007': '日期时间格式不正确',
  '22008': '日期时间超出范围',
  '22P02': '字段格式不正确',
}

/** Walk the drizzle-wrapped cause chain to find the pg error (carrying a 5-char SQLSTATE code) */
export function findPgError(err: unknown): PgErrorLike | null {
  let cur: unknown = err
  for (let depth = 0; depth < 5 && cur && typeof cur === 'object'; depth += 1) {
    const code = (cur as { code?: unknown }).code
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return cur as PgErrorLike
    cur = (cur as { cause?: unknown }).cause
  }
  return null
}

/** DB errors attributable to input data → ServiceError(400); otherwise null */
export function dbConstraintError(err: unknown): ServiceError | null {
  const pg = findPgError(err)
  const message = pg ? MESSAGES[pg.code] : undefined
  return message ? new ServiceError(message, 400) : null
}
