/**
 * Shared column builders
 *
 * Timestamp column defaults are **app-side** defaults (no DB DEFAULT), so the app must supply a value on insert.
 * `timezone('utc', now())` is used here so the database generates the UTC time:
 * microsecond precision is kept and JS `Date` is bypassed. `$defaultFn` only applies at runtime and doesn't go into the DDL,
 * so the baseline doesn't drift from the existing database.
 *
 * Timestamp columns always use `mode: 'string'`: the driver returns `YYYY-MM-DD HH:mm:ss[.ffffff]` text as-is, emitted via
 * `common/serialize.toIso()`.
 */

import { sql } from 'drizzle-orm'
import { timestamp } from 'drizzle-orm/pg-core'

export const utcNow = () => sql`timezone('utc', now())`

/** `default=datetime.utcnow` */
export const createdAt = () => timestamp({ mode: 'string' }).$defaultFn(utcNow)

/** `default=datetime.utcnow, onupdate=datetime.utcnow` */
export const updatedAt = () => timestamp({ mode: 'string' }).$defaultFn(utcNow).$onUpdateFn(utcNow)
