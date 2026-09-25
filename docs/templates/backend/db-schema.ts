/**
 * Table definition template → apps/api/src/db/schema/<domain>/<resource>.ts (file names use hyphens: customer-order.ts)
 *
 * TODO: replace <Resource> with the type name (PascalCase, e.g. Customer)
 * TODO: replace <resource> with the resource name (snake_case, e.g. customer); the table name is the plural <resource>s
 * TODO: register in apps/api/src/db/schema/index.ts: export * from './<domain>/<resource>'
 *
 * Conventions:
 * - Field type inference, see AGENTS.md: str → varchar({ length: 100 }), text → text(), int → integer(),
 *   float → numeric({ precision: 10, scale: 2 }), bool → boolean(), date → date({ mode: 'string' }),
 *   datetime → timestamp({ mode: 'string' })
 * - Timestamp columns use createdAt()/updatedAt() (app-side default `timezone('utc', now())`, no DEFAULT in the DB); output always goes through toIso()
 * - numeric columns stay strings (do not parseFloat); date columns are 'YYYY-MM-DD' text
 * - Only pgTable + toDict here, no business logic
 * - After changing the table structure run `pnpm db:generate --name <description>` + `pnpm db:migrate`, and confirm it landed with psql \d
 */

import { pgTable, serial, varchar } from 'drizzle-orm/pg-core'
import { toIso } from '@/common/serialize'
import { createdAt, updatedAt } from '../columns'

export const <resource>s = pgTable('<resource>s', {
  id: serial().primaryKey().notNull(),

  // TODO: replace with the actual fields
  name: varchar({ length: 100 }).notNull(),
  // status: varchar({ length: 20 }).notNull().$default(() => 'active'),
  // description: text(),
  // sort_order: integer().$default(() => 0),

  created_at: createdAt(),
  updated_at: updatedAt(),
})

export type <Resource> = typeof <resource>s.$inferSelect
export type New<Resource> = typeof <resource>s.$inferInsert

/** Serializes to API output; multi-word resources use camelCase names (customerOrderToDict) */
export function <resource>ToDict(item: <Resource>) {
  return {
    id: item.id,
    // TODO: add the actual fields
    name: item.name,
    created_at: toIso(item.created_at),
    updated_at: toIso(item.updated_at),
  }
}
