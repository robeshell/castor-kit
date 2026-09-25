/**
 * 表定义模板 → apps/api/src/db/schema/<domain>/<resource>.ts（文件名用连字符：customer-order.ts）
 *
 * TODO: 替换 <Resource> 为类型名（大驼峰，如 Customer）
 * TODO: 替换 <resource> 为资源名（下划线，如 customer）；表名为复数 <resource>s
 * TODO: 在 apps/api/src/db/schema/index.ts 注册：export * from './<domain>/<resource>'
 *
 * 约定：
 * - 字段类型推断见 AGENTS.md：str → varchar({ length: 100 })、text → text()、int → integer()、
 *   float → numeric({ precision: 10, scale: 2 })、bool → boolean()、date → date({ mode: 'string' })、
 *   datetime → timestamp({ mode: 'string' })
 * - 时间列用 createdAt()/updatedAt()（应用侧默认 `timezone('utc', now())`，库里没有 DEFAULT），输出统一走 toIso()
 * - numeric 列保持字符串（不要 parseFloat），date 列是 'YYYY-MM-DD' 文本
 * - 只放 pgTable + toDict，不写业务逻辑
 * - 改完表结构后执行 `pnpm db:generate --name <描述>` + `pnpm db:migrate`，并用 psql \d 确认落库
 */

import { pgTable, serial, varchar } from 'drizzle-orm/pg-core'
import { toIso } from '@/common/serialize'
import { createdAt, updatedAt } from '../columns'

export const <resource>s = pgTable('<resource>s', {
  id: serial().primaryKey().notNull(),

  // TODO: 替换为实际字段
  name: varchar({ length: 100 }).notNull(),
  // status: varchar({ length: 20 }).notNull().$default(() => 'active'),
  // description: text(),
  // sort_order: integer().$default(() => 0),

  created_at: createdAt(),
  updated_at: updatedAt(),
})

export type <Resource> = typeof <resource>s.$inferSelect
export type New<Resource> = typeof <resource>s.$inferInsert

/** 序列化为 API 输出；多词资源命名为 camelCase（customerOrderToDict） */
export function <resource>ToDict(item: <Resource>) {
  return {
    id: item.id,
    // TODO: 补充实际字段
    name: item.name,
    created_at: toIso(item.created_at),
    updated_at: toIso(item.updated_at),
  }
}
