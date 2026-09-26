/**
 * Account security: server-side sessions, password reset tokens, two-factor recovery codes, system settings
 */

import { foreignKey, index, integer, jsonb, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core'
import { toIso } from '@/common/serialize'
import { createdAt, updatedAt } from '../columns'
import { admin_users } from './rbac'

/**
 * One row per sign-in. The session cookie only carries the id (and the CSRF token); whether it is signed in, who it
 * belongs to and until when are decided here, so a session can be listed and revoked.
 */
export const sessions = pgTable(
  'sessions',
  {
    /** 32 random bytes, hex */
    id: varchar({ length: 64 }).primaryKey().notNull(),
    user_id: integer().notNull(),
    ip: varchar({ length: 64 }),
    user_agent: varchar({ length: 500 }),
    /** null = signed in; 'verify' = password OK, waiting for the TOTP code; 'setup' = must enroll TOTP first */
    mfa_state: varchar({ length: 20 }),
    created_at: createdAt(),
    last_seen_at: timestamp({ mode: 'string' }),
    expires_at: timestamp({ mode: 'string' }).notNull(),
    revoked_at: timestamp({ mode: 'string' }),
  },
  (table) => [
    foreignKey({ columns: [table.user_id], foreignColumns: [admin_users.id], name: 'sessions_user_id_fkey' }).onDelete('cascade'),
    index('sessions_user_id_idx').on(table.user_id),
    index('sessions_expires_at_idx').on(table.expires_at),
  ],
)

/** Password reset links: only the sha256 of the token is stored; single use */
export const password_reset_tokens = pgTable(
  'password_reset_tokens',
  {
    id: serial().primaryKey().notNull(),
    user_id: integer().notNull(),
    token_hash: varchar({ length: 64 }).notNull(),
    requested_ip: varchar({ length: 64 }),
    created_at: createdAt(),
    expires_at: timestamp({ mode: 'string' }).notNull(),
    used_at: timestamp({ mode: 'string' }),
  },
  (table) => [
    foreignKey({ columns: [table.user_id], foreignColumns: [admin_users.id], name: 'password_reset_tokens_user_id_fkey' }).onDelete('cascade'),
    index('password_reset_tokens_hash_idx').on(table.token_hash),
  ],
)

/** Two-factor recovery codes: sha256 only, each usable once */
export const user_recovery_codes = pgTable(
  'user_recovery_codes',
  {
    id: serial().primaryKey().notNull(),
    user_id: integer().notNull(),
    code_hash: varchar({ length: 64 }).notNull(),
    created_at: createdAt(),
    used_at: timestamp({ mode: 'string' }),
  },
  (table) => [
    foreignKey({ columns: [table.user_id], foreignColumns: [admin_users.id], name: 'user_recovery_codes_user_id_fkey' }).onDelete('cascade'),
    index('user_recovery_codes_user_id_idx').on(table.user_id),
  ],
)

/** Feature switches and parameters editable in 系统设置 (keys and types are defined in common/settings.ts) */
export const system_settings = pgTable(
  'system_settings',
  {
    key: varchar({ length: 100 }).primaryKey().notNull(),
    value: jsonb().notNull(),
    updated_at: updatedAt(),
    updated_by: integer(),
  },
  (table) => [
    foreignKey({ columns: [table.updated_by], foreignColumns: [admin_users.id], name: 'system_settings_updated_by_fkey' }).onDelete('set null'),
  ],
)

export type SessionRow = typeof sessions.$inferSelect

/** A session as shown in 在线用户 / 登录设备 (never the id itself: it is the credential) */
export function sessionToDict(row: SessionRow & { username?: string | null; nickname?: string | null }, currentId?: string) {
  return {
    /** Opaque handle for revoking: a prefix is enough to address the row and useless as a cookie */
    key: row.id.slice(0, 16),
    user_id: row.user_id,
    username: row.username ?? null,
    nickname: row.nickname ?? null,
    ip: row.ip,
    user_agent: row.user_agent,
    created_at: toIso(row.created_at),
    last_seen_at: toIso(row.last_seen_at),
    expires_at: toIso(row.expires_at),
    current: currentId !== undefined && row.id === currentId,
  }
}
