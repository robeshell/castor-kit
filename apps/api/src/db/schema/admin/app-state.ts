/**
 * app_state: small key / value store for instance-level state (e.g. when the demo data was last reset)
 */

import { pgTable, text, varchar } from 'drizzle-orm/pg-core'
import { updatedAt } from '../columns'

export const app_state = pgTable('app_state', {
  key: varchar({ length: 100 }).primaryKey().notNull(),
  value: text(),
  updated_at: updatedAt(),
})
