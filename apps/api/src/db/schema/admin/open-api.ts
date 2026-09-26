/**
 * Open API: API tokens (Bearer access for scripts and other systems) and webhooks (events pushed to other systems)
 */

import { boolean, foreignKey, index, integer, jsonb, pgTable, serial, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { toIso } from '@/common/serialize'
import { createdAt, updatedAt } from '../columns'
import { admin_users } from './rbac'

/**
 * A token acts as its creator, limited to `scopes` (menu / button permission codes). Only the sha256 of the token is
 * stored; `token_prefix` ("ck_" + 8 characters) identifies it in lists.
 */
export const api_tokens = pgTable(
  'api_tokens',
  {
    id: serial().primaryKey().notNull(),
    name: varchar({ length: 100 }).notNull(),
    token_prefix: varchar({ length: 16 }).notNull(),
    token_hash: varchar({ length: 64 }).notNull(),
    scopes: jsonb().$type<string[]>().notNull(),
    /** null = never expires */
    expires_at: timestamp({ mode: 'string' }),
    last_used_at: timestamp({ mode: 'string' }),
    last_used_ip: varchar({ length: 64 }),
    created_by: integer().notNull(),
    created_at: createdAt(),
    revoked_at: timestamp({ mode: 'string' }),
  },
  (table) => [
    foreignKey({ columns: [table.created_by], foreignColumns: [admin_users.id], name: 'api_tokens_created_by_fkey' }).onDelete('cascade'),
    index('api_tokens_token_hash_idx').on(table.token_hash),
    index('api_tokens_created_by_idx').on(table.created_by),
  ],
)

export type ApiToken = typeof api_tokens.$inferSelect

export function apiTokenToDict(row: ApiToken & { creator_username?: string | null; creator_nickname?: string | null }) {
  return {
    id: row.id,
    name: row.name,
    token_prefix: row.token_prefix,
    scopes: row.scopes,
    expires_at: toIso(row.expires_at),
    last_used_at: toIso(row.last_used_at),
    last_used_ip: row.last_used_ip,
    created_by: row.created_by,
    creator_username: row.creator_username ?? null,
    creator_nickname: row.creator_nickname ?? null,
    created_at: toIso(row.created_at),
    revoked_at: toIso(row.revoked_at),
  }
}

/** A receiver of events. `secret` is sealed with common/secret-box.ts and signs every delivery (HMAC-SHA256) */
export const webhooks = pgTable(
  'webhooks',
  {
    id: serial().primaryKey().notNull(),
    name: varchar({ length: 100 }).notNull(),
    url: varchar({ length: 500 }).notNull(),
    /** Event names, "*" (everything) or prefixes like "user.*" */
    events: jsonb().$type<string[]>().notNull(),
    secret: text().notNull(),
    is_active: boolean().default(true).notNull(),
    created_by: integer(),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (table) => [
    foreignKey({ columns: [table.created_by], foreignColumns: [admin_users.id], name: 'webhooks_created_by_fkey' }).onDelete('set null'),
  ],
)

export type Webhook = typeof webhooks.$inferSelect

export function webhookToDict(row: Webhook) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    events: row.events,
    is_active: row.is_active,
    created_by: row.created_by,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  }
}

/**
 * One event for one webhook. status: pending (waiting / due for a retry), delivering (claimed by a process),
 * success, failed (gave up after the last attempt)
 */
export const webhook_deliveries = pgTable(
  'webhook_deliveries',
  {
    id: serial().primaryKey().notNull(),
    webhook_id: integer().notNull(),
    /** Same for every webhook receiving this event (X-Castor-Delivery), so receivers can de-duplicate */
    event_id: uuid().notNull(),
    event: varchar({ length: 100 }).notNull(),
    payload: jsonb().notNull(),
    status: varchar({ length: 20 }).default('pending').notNull(),
    attempts: integer().default(0).notNull(),
    response_code: integer(),
    /** First 2000 characters of the response, or the connection error */
    response_body: text(),
    next_retry_at: timestamp({ mode: 'string' }),
    delivered_at: timestamp({ mode: 'string' }),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (table) => [
    foreignKey({ columns: [table.webhook_id], foreignColumns: [webhooks.id], name: 'webhook_deliveries_webhook_id_fkey' }).onDelete('cascade'),
    index('webhook_deliveries_webhook_id_idx').on(table.webhook_id),
    index('webhook_deliveries_due_idx').on(table.status, table.next_retry_at),
  ],
)

export type WebhookDelivery = typeof webhook_deliveries.$inferSelect

export function webhookDeliveryToDict(row: WebhookDelivery) {
  return {
    id: row.id,
    webhook_id: row.webhook_id,
    event_id: row.event_id,
    event: row.event,
    payload: row.payload,
    status: row.status,
    attempts: row.attempts,
    response_code: row.response_code,
    response_body: row.response_body,
    next_retry_at: toIso(row.next_retry_at),
    delivered_at: toIso(row.delivered_at),
    created_at: toIso(row.created_at),
  }
}
