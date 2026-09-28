/**
 * Which database tables are "business tables": the ones the read-only role may SELECT (scripts/init-ro-role.ts) and
 * the AI SQL page may show to the model. Tables holding credentials, permissions, sessions or internal logs never are.
 */

// Excluded by exact name, by prefix and by suffix
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
