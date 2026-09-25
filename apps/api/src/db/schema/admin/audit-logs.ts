/**
 * Audit log tables: login_logs / operation_logs
 */

import { foreignKey, index, integer, pgTable, serial, text, varchar } from 'drizzle-orm/pg-core'
import { toIso } from '@/common/serialize'
import { createdAt } from '../columns'
import { admin_users } from './rbac'

export const login_logs = pgTable(
  'login_logs',
  {
    id: serial().primaryKey().notNull(),
    username: varchar({ length: 100 }).notNull(),
    user_id: integer(),
    status: varchar({ length: 20 }).notNull().$default(() => 'success'),
    ip: varchar({ length: 64 }),
    user_agent: varchar({ length: 500 }),
    message: varchar({ length: 500 }),
    created_at: createdAt(),
  },
  (table) => [
    // Shared by the login rate-limit query (status + time window) and login log list sorting
    index('ix_login_logs_status_created_at').using('btree', table.status, table.created_at),
    foreignKey({
      columns: [table.user_id],
      foreignColumns: [admin_users.id],
      name: 'login_logs_user_id_fkey',
    }).onDelete('set null'),
  ],
)

export const operation_logs = pgTable(
  'operation_logs',
  {
    id: serial().primaryKey().notNull(),
    username: varchar({ length: 100 }).notNull(),
    user_id: integer(),
    module: varchar({ length: 100 }).notNull(),
    action: varchar({ length: 50 }).notNull(),
    method: varchar({ length: 10 }).notNull(),
    path: varchar({ length: 255 }).notNull(),
    target_id: varchar({ length: 100 }),
    payload: text(),
    ip: varchar({ length: 64 }),
    user_agent: varchar({ length: 500 }),
    status_code: integer(),
    created_at: createdAt(),
  },
  (table) => [
    foreignKey({
      columns: [table.user_id],
      foreignColumns: [admin_users.id],
      name: 'operation_logs_user_id_fkey',
    }).onDelete('set null'),
  ],
)

export type LoginLog = typeof login_logs.$inferSelect
export type NewLoginLog = typeof login_logs.$inferInsert
export type OperationLog = typeof operation_logs.$inferSelect
export type NewOperationLog = typeof operation_logs.$inferInsert

export function loginLogToDict(log: LoginLog) {
  return {
    id: log.id,
    username: log.username,
    user_id: log.user_id,
    status: log.status,
    ip: log.ip,
    user_agent: log.user_agent,
    message: log.message,
    created_at: toIso(log.created_at),
  }
}

export function operationLogToDict(log: OperationLog) {
  return {
    id: log.id,
    username: log.username,
    user_id: log.user_id,
    module: log.module,
    action: log.action,
    method: log.method,
    path: log.path,
    target_id: log.target_id,
    payload: log.payload,
    ip: log.ip,
    user_agent: log.user_agent,
    status_code: log.status_code,
    created_at: toIso(log.created_at),
  }
}
