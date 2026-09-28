/**
 * PostgreSQL constraint / data errors → 400 business errors.
 *
 * Unique violations, over-long values, numeric overflow and the like are caused by user input; they must not become 500s or leak raw pg messages to the frontend.
 * The global error handler applies it to every unhandled error; services catching a failed write use writeError() below.
 */

import { internalError, ServiceError } from './errors'

interface PgErrorLike {
  code: string
  constraint?: string
  column?: string
  /** e.g. `Key (username)=(admin) already exists.` on a unique violation */
  detail?: string
}

/** Each message says what went wrong and what to do; the unique / not-null ones name the column when pg reports it */
const MESSAGES: Record<string, string> = {
  '23505': '已有记录使用了相同的值，请换一个值后再保存',
  '23502': '有必填字段没有填写，请补全后再保存',
  '23503': '关联的数据不存在，或这条数据仍被其他数据使用，请检查关联后重试',
  '23514': '有字段的值不在允许的范围内，请检查后再保存',
  '22001': '有字段超出了长度上限，请缩短后再保存',
  '22003': '有数字超出了允许的范围，请检查后再保存',
  '22007': '有日期时间的格式不正确，请检查后再保存',
  '22008': '有日期时间超出了允许的范围，请检查后再保存',
  '22P02': '有字段的格式不正确（例如数字字段里填了文字），请检查后再保存',
}

/** The column(s) of a unique violation, from pg's detail text */
const uniqueColumns = (detail: string | undefined) => detail?.match(/^Key \((.+?)\)=/)?.[1]

/** The message for a pg error, naming the field when pg says which one */
function messageFor(pg: PgErrorLike): string | undefined {
  if (pg.code === '23505') {
    const columns = uniqueColumns(pg.detail)
    if (columns) return `字段「${columns}」的值已被使用，请换一个值后再保存`
  }
  if (pg.code === '23502' && pg.column) return `必填字段「${pg.column}」没有填写，请补全后再保存`
  return MESSAGES[pg.code]
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
  const message = pg ? messageFor(pg) : undefined
  return message ? new ServiceError(message, 400) : null
}

/**
 * The error to throw when a write (usually a transaction) fails: business errors (ServiceError) as they are, the
 * database rejecting the request's data → 400, anything else → 500
 */
export function writeError(err: unknown): ServiceError {
  if (err instanceof ServiceError) return err
  return dbConstraintError(err) ?? internalError(err)
}

/** Whether a DB execution error (incl. the drizzle-wrapped cause chain) mentions a constraint/keyword */
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
