/**
 * RBAC 表：admin_users / roles / menus / user_roles / role_menus
 * 对齐 AuraStack backend/app/admin/model/entities_rbac.py
 */

import { relations } from 'drizzle-orm'
import {
  boolean,
  foreignKey,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'
import { collectMenuCodes } from '@/common/rbac'
import { toIso } from '@/common/serialize'
import { createdAt, updatedAt } from '../columns'

export const admin_users = pgTable(
  'admin_users',
  {
    id: serial().primaryKey().notNull(),
    username: varchar({ length: 50 }).notNull(),
    password_hash: varchar({ length: 200 }).notNull(),
    created_at: createdAt(),
  },
  (table) => [unique('admin_users_username_key').on(table.username)],
)

export const roles = pgTable(
  'roles',
  {
    id: serial().primaryKey().notNull(),
    name: varchar({ length: 100 }).notNull(),
    code: varchar({ length: 50 }).notNull(),
    description: text(),
    created_at: createdAt(),
  },
  (table) => [unique('roles_code_key').on(table.code)],
)

export const menus = pgTable(
  'menus',
  {
    id: serial().primaryKey().notNull(),
    name: varchar({ length: 100 }).notNull(),
    code: varchar({ length: 50 }).notNull(),
    icon: varchar({ length: 100 }),
    path: varchar({ length: 200 }),
    component: varchar({ length: 200 }),
    parent_id: integer(),
    sort_order: integer().$default(() => 0),
    is_visible: boolean().$default(() => true),
    is_active: boolean().$default(() => true),
    menu_type: varchar({ length: 20 }).$default(() => 'menu'),
    description: text(),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (table) => [
    foreignKey({
      columns: [table.parent_id],
      foreignColumns: [table.id],
      name: 'menus_parent_id_fkey',
    }).onDelete('cascade'),
    unique('menus_code_key').on(table.code),
  ],
)

export const user_roles = pgTable(
  'user_roles',
  {
    user_id: integer().notNull(),
    role_id: integer().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.role_id],
      foreignColumns: [roles.id],
      name: 'user_roles_role_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.user_id],
      foreignColumns: [admin_users.id],
      name: 'user_roles_user_id_fkey',
    }).onDelete('cascade'),
    primaryKey({ columns: [table.user_id, table.role_id], name: 'user_roles_pkey' }),
  ],
)

export const role_menus = pgTable(
  'role_menus',
  {
    role_id: integer().notNull(),
    menu_id: integer().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.menu_id],
      foreignColumns: [menus.id],
      name: 'role_menus_menu_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.role_id],
      foreignColumns: [roles.id],
      name: 'role_menus_role_id_fkey',
    }).onDelete('cascade'),
    primaryKey({ columns: [table.role_id, table.menu_id], name: 'role_menus_pkey' }),
  ],
)

// ---- relations（只做显式查询，不做隐式懒加载；对应 SQLAlchemy 的 roles / menus / children） ----

export const admin_users_relations = relations(admin_users, ({ many }) => ({
  user_roles: many(user_roles),
}))

export const roles_relations = relations(roles, ({ many }) => ({
  user_roles: many(user_roles),
  role_menus: many(role_menus),
}))

export const menus_relations = relations(menus, ({ one, many }) => ({
  parent: one(menus, { fields: [menus.parent_id], references: [menus.id], relationName: 'menu_parent' }),
  children: many(menus, { relationName: 'menu_parent' }),
  role_menus: many(role_menus),
}))

export const user_roles_relations = relations(user_roles, ({ one }) => ({
  user: one(admin_users, { fields: [user_roles.user_id], references: [admin_users.id] }),
  role: one(roles, { fields: [user_roles.role_id], references: [roles.id] }),
}))

export const role_menus_relations = relations(role_menus, ({ one }) => ({
  role: one(roles, { fields: [role_menus.role_id], references: [roles.id] }),
  menu: one(menus, { fields: [role_menus.menu_id], references: [menus.id] }),
}))

// ---- 类型 ----

export type AdminUser = typeof admin_users.$inferSelect
export type Role = typeof roles.$inferSelect
export type Menu = typeof menus.$inferSelect

export type RoleWithMenus = Role & { menus: Menu[] }
/** 已预加载 roles → menus 的用户（对应 Python 里 joinedload(roles).joinedload(menus) 的 Admin 实例） */
export type AdminUserWithRoles = AdminUser & { roles: RoleWithMenus[] }

// ---- toDict（对齐 Python to_dict 的键与值） ----

export function roleToDict(role: Role | RoleWithMenus, includeMenus = false) {
  const result: Record<string, unknown> = {
    id: role.id,
    name: role.name,
    code: role.code,
    description: role.description,
    created_at: toIso(role.created_at),
  }
  if (includeMenus && 'menus' in role) {
    const sorted = [...role.menus].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id)
    result.menu_ids = sorted.map((m) => m.id)
    result.menus = sorted.map((m) => ({
      id: m.id,
      name: m.name,
      code: m.code,
      parent_id: m.parent_id,
      menu_type: m.menu_type,
    }))
  }
  return result
}

export function adminUserToDict(user: AdminUserWithRoles) {
  return {
    id: user.id,
    username: user.username,
    created_at: toIso(user.created_at),
    roles: user.roles.map((role) => roleToDict(role)),
    menu_codes: collectMenuCodes(user),
  }
}

export interface MenuDict {
  id: number
  name: string
  code: string
  icon: string | null
  path: string | null
  component: string | null
  parent_id: number | null
  sort_order: number | null
  is_visible: boolean | null
  is_active: boolean | null
  menu_type: string | null
  description: string | null
  created_at: string | null
  updated_at: string | null
  children?: MenuDict[]
}

/** `Menu.to_dict(include_children=False)`；带 children 的树由调用方显式查询后组装 */
export function menuToDict(menu: Menu): MenuDict {
  return {
    id: menu.id,
    name: menu.name,
    code: menu.code,
    icon: menu.icon,
    path: menu.path,
    component: menu.component,
    parent_id: menu.parent_id,
    sort_order: menu.sort_order,
    is_visible: menu.is_visible,
    is_active: menu.is_active,
    menu_type: menu.menu_type,
    description: menu.description,
    created_at: toIso(menu.created_at),
    updated_at: toIso(menu.updated_at),
  }
}
