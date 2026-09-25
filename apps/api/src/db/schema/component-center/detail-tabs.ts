/**
 * cc_detail_members
 *
 * 由 drizzle-kit pull 生成后整理。status/avatar_color 等列在现库里有 DB DEFAULT（.default()）；
 * created_at/updated_at 是应用侧默认值，用 ../columns 的 createdAt()/updatedAt()。
 */

import { boolean, date, integer, pgTable, serial, text, varchar } from 'drizzle-orm/pg-core'
import { toIso } from '@/common/serialize'
import { createdAt, updatedAt } from '../columns'

export const cc_detail_members = pgTable('cc_detail_members', {
  id: serial().primaryKey().notNull(),
  name: varchar({ length: 100 }).notNull(),
  department: varchar({ length: 100 }),
  role_title: varchar({ length: 100 }),
  email: varchar({ length: 200 }),
  phone: varchar({ length: 50 }),
  status: varchar({ length: 20 }).default('active'),
  join_date: date({ mode: 'string' }),
  avatar_color: varchar({ length: 20 }).default('#4080FF'),
  bio: text(),
  sort_order: integer().default(0),
  is_active: boolean().default(true),
  created_at: createdAt(),
  updated_at: updatedAt(),
})

export type DetailMember = typeof cc_detail_members.$inferSelect

/** 成员输出 */
export function detailMemberToDict(m: DetailMember) {
  return {
    id: m.id,
    name: m.name,
    department: m.department,
    role_title: m.role_title,
    email: m.email,
    phone: m.phone,
    status: m.status || 'active',
    join_date: m.join_date || null,
    avatar_color: m.avatar_color || '#4080FF',
    bio: m.bio,
    sort_order: m.sort_order ?? 0,
    is_active: m.is_active,
    created_at: toIso(m.created_at),
    updated_at: toIso(m.updated_at),
  }
}
