/**
 * PostgreSQL 约束 / 数据错误 → 400 业务错误。
 *
 * 唯一冲突、字段超长、数值溢出这类错误是用户输入造成的，不该变成 500 并把 pg 原始信息透给前端。
 * scaffold 生成的 service 在事务包装里调用它；其余错误返回 null，由调用方按 500 处理。
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

/** 沿 drizzle 包装的 cause 链找 pg 错误（带 5 位 SQLSTATE code） */
export function findPgError(err: unknown): PgErrorLike | null {
  let cur: unknown = err
  for (let depth = 0; depth < 5 && cur && typeof cur === 'object'; depth += 1) {
    const code = (cur as { code?: unknown }).code
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return cur as PgErrorLike
    cur = (cur as { cause?: unknown }).cause
  }
  return null
}

/** 能归因于输入数据的数据库错误 → ServiceError(400)；否则 null */
export function dbConstraintError(err: unknown): ServiceError | null {
  const pg = findPgError(err)
  const message = pg ? MESSAGES[pg.code] : undefined
  return message ? new ServiceError(message, 400) : null
}
