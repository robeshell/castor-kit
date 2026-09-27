/**
 * AI SQL pure functions: SQL cleanup and safety checks, table visibility (isVisibleTable), read-only query wrapping
 *
 * Regexes follow Unicode semantics:
 * - `\b` word characters are Unicode letters/digits/underscore (JS `\b` without the u flag is ASCII-only, so lookarounds emulate it)
 * - whitespace: see WS_CLASS (Unicode whitespace plus the ASCII separators \x1c-\x1f and NEL, so an unusual space can't hide a keyword)
 */

import { z } from 'zod'
import { field } from '@/common/validation'

export const generateBody = z.object({ question: field.requiredText('问题', '问题不能为空') })
export const executeBody = z.object({ sql: field.requiredText('SQL', 'SQL 不能为空') })

/** Max rows returned per query */
export const MAX_SQL_ROWS = 200

// ---- Sensitive tables: AI SQL neither shows their schema to the LLM/frontend nor grants them to the read-only role ----
const SENSITIVE_EXACT = new Set(['roles', 'menus', 'user_roles', 'role_menus', 'role_depts', 'files', 'file_references', 'sessions', 'system_settings', 'password_reset_tokens', 'user_recovery_codes', 'api_tokens', 'webhooks', 'webhook_deliveries'])
const SENSITIVE_PREFIX = ['admin_', 'audit_', 'scheduled_task']
const SENSITIVE_SUFFIX = ['_logs']

/** Only business tables are visible/grantable; tables holding credentials or internal info are always excluded */
export function isVisibleTable(tableName: string | null | undefined): boolean {
  const name = (tableName || '').toLowerCase()
  if (SENSITIVE_EXACT.has(name)) return false
  if (SENSITIVE_PREFIX.some((p) => name.startsWith(p)) || SENSITIVE_SUFFIX.some((s) => name.endsWith(s))) return false
  return true
}

// ---- Whitespace / word characters ----

const WS_CLASS = '\\s\\x1c-\\x1f\\x85'
const WORD_CLASS = '\\p{L}\\p{N}_'
const LEADING_WS = new RegExp(`^[${WS_CLASS}]+`, 'u')
const TRAILING_WS = new RegExp(`[${WS_CLASS}]+$`, 'u')

/** Trim leading and trailing whitespace (whitespace set: see WS_CLASS) */
export function trimSql(text: string): string {
  return trimSqlEnd(text.replace(LEADING_WS, ''))
}

/** Trim trailing whitespace */
export function trimSqlEnd(text: string): string {
  return text.replace(TRAILING_WS, '')
}

/** Strip trailing semicolons */
function rstripSemicolons(text: string): string {
  return text.replace(/;+$/, '')
}

/** Match pattern at word boundaries (`\b` emulated with Unicode word-character lookarounds; pattern consists of word characters) */
function wordRegex(pattern: string): RegExp {
  return new RegExp(`(?<![${WORD_CLASS}])${pattern}(?![${WORD_CLASS}])`, 'u')
}

// ---- SQL safety checks ----

// Single-quoted string literals (incl. '' escapes and double-quoted identifiers); keywords are checked after stripping them so
// literals/identifiers like SELECT 'delete' / "DROP" don't cause false positives. The read-only engine is still the real backstop.
const STRING_LITERAL_RE = /'(?:''|[^'])*'|"(?:""|[^"])*"/gs

/** Remove string/identifier literals, returning the residual text used for keyword checks */
export function stripLiterals(sql: string): string {
  return sql.replace(STRING_LITERAL_RE, ' ')
}

// DML / DDL / control-statement keywords (banning SET blocks SET ROLE / SET ... read_only=off)
const CONTROL_KEYWORDS = [
  'ALTER', 'CREATE', 'DROP', 'TRUNCATE', 'GRANT', 'REVOKE',
  'DELETE', 'UPDATE', 'INSERT', 'INTO', 'MERGE', 'CALL', 'DO',
  'VACUUM', 'ANALYZE', 'REINDEX', 'CLUSTER', 'REFRESH', 'LOCK',
  'COPY', 'SET', 'RESET', 'DISCARD', 'COMMENT', 'EXEC', 'EXECUTE',
].map((kw) => [kw, wordRegex(kw)] as const)

const FOR_LOCK_RE = new RegExp(
  `(?<![${WORD_CLASS}])FOR[${WS_CLASS}]+(UPDATE|SHARE)(?![${WORD_CLASS}])`,
  'u',
)

// Dangerous function calls (only real function calls are blocked; column names etc. are unaffected)
const DANGEROUS_FUNCS = [
  'pg_read_file', 'pg_read_binary_file', 'pg_write_file', 'pg_ls_dir',
  'pg_ls_logdir', 'pg_ls_waldir', 'pg_stat_file', 'pg_relation_filepath',
  'pg_terminate_backend', 'pg_cancel_backend', 'pg_sleep', 'pg_sleep_for',
  'pg_sleep_until', 'pg_execute_server_program', 'pg_log_backend_memory_contexts',
  'set_config', 'lo_import', 'lo_export', 'lo_unlink', 'pg_reload_conf',
  'pg_rotate_logfile', 'pg_start_backup', 'pg_stop_backup', 'pg_switch_wal',
  'pg_create_restore_point', 'dblink',
].map(
  (fn) => [fn, new RegExp(`(?<![${WORD_CLASS}])${fn.toUpperCase()}[${WS_CLASS}]*\\(`, 'u')] as const,
)

export type SafeResult = [true, null] | [false, string]

/** Only a single SELECT / WITH (CTE) query is allowed; blocks writes, DDL, control statements and dangerous functions */
export function isSafeSql(sql: string): SafeResult {
  // Strip comments so their content can't affect the check
  let stripped = sql.replace(/--[^\n]*/g, ' ')
  stripped = stripped.replace(/\/\*.*?\*\//gs, ' ')
  // Strip trailing semicolons (the LLM may end with ;)
  stripped = trimSqlEnd(rstripSemicolons(trimSqlEnd(stripped)))
  const clean = trimSql(stripped).toUpperCase()

  if (!(clean.startsWith('SELECT') || clean.startsWith('WITH'))) {
    return [false, '只允许 SELECT 查询语句']
  }
  if (clean.includes(';')) {
    return [false, '仅允许单条语句，不能包含分号']
  }

  // Keyword/function checks run after stripping literals so string contents can't cause false positives (the read-only engine is the real protection)
  const code = stripLiterals(clean).toUpperCase()

  for (const [kw, re] of CONTROL_KEYWORDS) {
    if (re.test(code)) return [false, `SQL 包含不允许的操作关键字：${kw}`]
  }
  if (FOR_LOCK_RE.test(code)) {
    return [false, '不允许使用 FOR UPDATE / FOR SHARE']
  }
  for (const [fn, re] of DANGEROUS_FUNCS) {
    if (re.test(code)) return [false, `SQL 使用了不允许的函数：${fn}`]
  }
  return [true, null]
}

const WS_RUN = `[${WS_CLASS}]*`
const FENCE_SQL_START = new RegExp(`^\`\`\`sql${WS_RUN}`, 'iu')
const FENCE_START = new RegExp(`^\`\`\`${WS_RUN}`, 'u')
const FENCE_END = new RegExp(`${WS_RUN}\`\`\`$`, 'u')

/** Strip the markdown code-fence wrapper the LLM may output */
export function cleanSql(raw: string): string {
  let sql = trimSql(raw)
  sql = sql.replace(FENCE_SQL_START, '')
  sql = sql.replace(FENCE_START, '')
  sql = sql.replace(FENCE_END, '')
  return trimSql(sql)
}

/** Before read-only execution: strip trailing semicolons and whitespace, then wrap with LIMIT to enforce a server-side row cap (fetch 1 extra row to detect truncated) */
export function wrapReadonlySql(sql: string): string {
  const body = trimSqlEnd(rstripSemicolons(trimSqlEnd(sql)))
  return 'SELECT * FROM (' + body + ') AS _q LIMIT ' + String(MAX_SQL_ROWS + 1)
}
