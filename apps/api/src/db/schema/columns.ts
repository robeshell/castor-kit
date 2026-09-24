/**
 * 通用列构造器
 *
 * AuraStack 的时间列是 SQLAlchemy **应用侧**默认值（`default=datetime.utcnow`，库里没有 DEFAULT），
 * 所以 Node 插入时必须自己给值。这里用 `timezone('utc', now())` 让数据库生成 UTC 时间：
 * 保留微秒精度、不经过 JS `Date`（rewrite-plan §2.2）。`$defaultFn` 只在运行时生效，不进 DDL，
 * 因而不会让 baseline 与现库产生差异。
 *
 * 时间列一律 `mode: 'string'`：驱动层原样返回 `YYYY-MM-DD HH:mm:ss[.ffffff]` 文本，由
 * `common/serialize.toIso()` 输出。
 */

import { sql } from 'drizzle-orm'
import { timestamp } from 'drizzle-orm/pg-core'

export const utcNow = () => sql`timezone('utc', now())`

/** `default=datetime.utcnow` */
export const createdAt = () => timestamp({ mode: 'string' }).$defaultFn(utcNow)

/** `default=datetime.utcnow, onupdate=datetime.utcnow` */
export const updatedAt = () => timestamp({ mode: 'string' }).$defaultFn(utcNow).$onUpdateFn(utcNow)
