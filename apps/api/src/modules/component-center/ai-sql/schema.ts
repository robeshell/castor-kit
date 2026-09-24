/**
 * AI SQL 纯函数（对齐 AuraStack component_center/api/ai_sql.py 的工具函数 + ai_sql_engine.is_visible_table）
 *
 * 正则语义按 Python `re`（str 模式）复刻：
 * - `\b` 的单词字符是 Unicode 字母/数字/下划线（JS 不带 u 的 `\b` 只认 ASCII，这里用环视模拟）
 * - `\s` / `.strip()` 的空白集合是 Python `str.isspace()` 的集合（含 \x1c-\x1f、\x85，不含 ﻿）
 */

/** 单次查询最多返回行数 */
export const MAX_SQL_ROWS = 200

// ---- 敏感表：AI SQL 既不让 LLM/前端看到 schema，也不给只读账号授权 ----
const SENSITIVE_EXACT = new Set(['roles', 'menus', 'user_roles', 'role_menus'])
const SENSITIVE_PREFIX = ['admin_', 'audit_', 'scheduled_task']
const SENSITIVE_SUFFIX = ['_logs']

/** 业务表才可见/可授权；含凭据或内部信息的表一律排除 */
export function isVisibleTable(tableName: string | null | undefined): boolean {
  const name = (tableName || '').toLowerCase()
  if (SENSITIVE_EXACT.has(name)) return false
  if (SENSITIVE_PREFIX.some((p) => name.startsWith(p)) || SENSITIVE_SUFFIX.some((s) => name.endsWith(s))) return false
  return true
}

// ---- Python 空白 / 单词字符 ----

const PY_WS_CLASS = '\\t\\n\\v\\f\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000'
const PY_WORD_CLASS = '\\p{L}\\p{N}_'
const LEADING_WS = new RegExp(`^[${PY_WS_CLASS}]+`, 'u')
const TRAILING_WS = new RegExp(`[${PY_WS_CLASS}]+$`, 'u')

/** Python `str.strip()` */
export function pyStrip(text: string): string {
  return pyRstrip(text.replace(LEADING_WS, ''))
}

/** Python `str.rstrip()` */
export function pyRstrip(text: string): string {
  return text.replace(TRAILING_WS, '')
}

/** Python `str.rstrip(';')` */
function rstripSemicolons(text: string): string {
  return text.replace(/;+$/, '')
}

/** Python `re.search(rf'\b{word}\b', text)`（word 由单词字符组成） */
function wordRegex(pattern: string): RegExp {
  return new RegExp(`(?<![${PY_WORD_CLASS}])${pattern}(?![${PY_WORD_CLASS}])`, 'u')
}

// ---- SQL 安全判定 ----

// 单引号字符串字面量（含 '' 转义与双引号标识符）；剥离后做关键字判定，避免
// SELECT 'delete' / "DROP" 这类字面量/标识符触发误杀。真实拦截仍由只读引擎兜底。
const STRING_LITERAL_RE = /'(?:''|[^'])*'|"(?:""|[^"])*"/gs

/** 移除字符串/标识符字面量，返回用于关键字判定的残影文本 */
export function stripLiterals(sql: string): string {
  return sql.replace(STRING_LITERAL_RE, ' ')
}

// DML / DDL / 控制语句关键字（禁 SET 封死 SET ROLE / SET ... read_only=off）
const CONTROL_KEYWORDS = [
  'ALTER', 'CREATE', 'DROP', 'TRUNCATE', 'GRANT', 'REVOKE',
  'DELETE', 'UPDATE', 'INSERT', 'INTO', 'MERGE', 'CALL', 'DO',
  'VACUUM', 'ANALYZE', 'REINDEX', 'CLUSTER', 'REFRESH', 'LOCK',
  'COPY', 'SET', 'RESET', 'DISCARD', 'COMMENT', 'EXEC', 'EXECUTE',
].map((kw) => [kw, wordRegex(kw)] as const)

const FOR_LOCK_RE = new RegExp(
  `(?<![${PY_WORD_CLASS}])FOR[${PY_WS_CLASS}]+(UPDATE|SHARE)(?![${PY_WORD_CLASS}])`,
  'u',
)

// 高危函数调用（仅拦截真实函数调用，列名等不受影响）
const DANGEROUS_FUNCS = [
  'pg_read_file', 'pg_read_binary_file', 'pg_write_file', 'pg_ls_dir',
  'pg_ls_logdir', 'pg_ls_waldir', 'pg_stat_file', 'pg_relation_filepath',
  'pg_terminate_backend', 'pg_cancel_backend', 'pg_sleep', 'pg_sleep_for',
  'pg_sleep_until', 'pg_execute_server_program', 'pg_log_backend_memory_contexts',
  'set_config', 'lo_import', 'lo_export', 'lo_unlink', 'pg_reload_conf',
  'pg_rotate_logfile', 'pg_start_backup', 'pg_stop_backup', 'pg_switch_wal',
  'pg_create_restore_point', 'dblink',
].map(
  (fn) => [fn, new RegExp(`(?<![${PY_WORD_CLASS}])${fn.toUpperCase()}[${PY_WS_CLASS}]*\\(`, 'u')] as const,
)

export type SafeResult = [true, null] | [false, string]

/** 只允许单条 SELECT / WITH（CTE）查询；拦截写操作、DDL、控制语句与高危函数 */
export function isSafeSql(sql: string): SafeResult {
  // 去除注释，避免注释内容干扰判定
  let stripped = sql.replace(/--[^\n]*/g, ' ')
  stripped = stripped.replace(/\/\*.*?\*\//gs, ' ')
  // 去尾部分号（LLM 可能输出结尾 ;）
  stripped = pyRstrip(rstripSemicolons(pyRstrip(stripped)))
  const clean = pyStrip(stripped).toUpperCase()

  if (!(clean.startsWith('SELECT') || clean.startsWith('WITH'))) {
    return [false, '只允许 SELECT 查询语句']
  }
  if (clean.includes(';')) {
    return [false, '仅允许单条语句，不能包含分号']
  }

  // 关键字/函数判定在剥离字面量后进行，避免字符串内容误杀（真实防护由只读引擎兜底）
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

const PY_WS_RUN = `[${PY_WS_CLASS}]*`
const FENCE_SQL_START = new RegExp(`^\`\`\`sql${PY_WS_RUN}`, 'iu')
const FENCE_START = new RegExp(`^\`\`\`${PY_WS_RUN}`, 'u')
const FENCE_END = new RegExp(`${PY_WS_RUN}\`\`\`$`, 'u')

/** 去除 LLM 可能输出的 markdown 代码块包装 */
export function cleanSql(raw: string): string {
  let sql = pyStrip(raw)
  sql = sql.replace(FENCE_SQL_START, '')
  sql = sql.replace(FENCE_START, '')
  sql = sql.replace(FENCE_END, '')
  return pyStrip(sql)
}

/** execute_readonly：去尾部分号与空白后包裹 LIMIT，强制服务端行数上限（多取 1 行用于判断 truncated） */
export function wrapReadonlySql(sql: string): string {
  const body = pyRstrip(rstripSemicolons(pyRstrip(sql)))
  return 'SELECT * FROM (' + body + ') AS _q LIMIT ' + String(MAX_SQL_ROWS + 1)
}
