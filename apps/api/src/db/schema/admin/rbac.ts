/**
 * RBAC tables: admin_users / roles / menus / user_roles / role_menus,
 * plus the data-scope tables: departments / role_depts (roles.data_scope decides which rows a role may see)
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
  timestamp,
  unique,
  varchar,
  type AnyPgColumn,
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
    nickname: varchar({ length: 100 }),
    email: varchar({ length: 100 }),
    phone: varchar({ length: 20 }),
    /** Avatar URL for now; becomes a file id once the file center lands */
    avatar: varchar({ length: 500 }),
    /** 'active' | 'disabled'. A real DB default (unlike the timestamp columns) so existing rows and raw INSERTs get it */
    status: varchar({ length: 20 }).notNull().default('active'),
    /** No FK name here: a named foreignKey() would make the admin_users ↔ departments types circular */
    dept_id: integer().references((): AnyPgColumn => departments.id, { onDelete: 'set null' }),
    last_login_at: timestamp({ mode: 'string' }),
    last_login_ip: varchar({ length: 64 }),
    /** TOTP secret, AES-256-GCM encrypted (common/secret-box.ts); set during enrollment, active once totp_enabled_at is set */
    totp_secret: text(),
    totp_enabled_at: timestamp({ mode: 'string' }),
    /** Last accepted TOTP time step, so a code can't be replayed */
    totp_last_step: integer(),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (table) => [
    unique('admin_users_username_key').on(table.username),
    unique('admin_users_email_key').on(table.email),
  ],
)

export const roles = pgTable(
  'roles',
  {
    id: serial().primaryKey().notNull(),
    name: varchar({ length: 100 }).notNull(),
    code: varchar({ length: 50 }).notNull(),
    description: text(),
    /** 'all' | 'dept_and_children' | 'dept' | 'self' | 'custom'; defaults to 'all' so existing roles keep seeing everything */
    data_scope: varchar({ length: 20 }).notNull().default('all'),
    created_at: createdAt(),
  },
  (table) => [unique('roles_code_key').on(table.code)],
)

export const departments = pgTable(
  'departments',
  {
    id: serial().primaryKey().notNull(),
    parent_id: integer(),
    name: varchar({ length: 100 }).notNull(),
    code: varchar({ length: 50 }).notNull(),
    leader_id: integer(),
    sort_order: integer().notNull().default(0),
    /** 'active' | 'disabled' */
    status: varchar({ length: 20 }).notNull().default('active'),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (table) => [
    foreignKey({
      columns: [table.parent_id],
      foreignColumns: [table.id],
      name: 'departments_parent_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.leader_id],
      foreignColumns: [admin_users.id],
      name: 'departments_leader_id_fkey',
    }).onDelete('set null'),
    unique('departments_code_key').on(table.code),
  ],
)

/** Departments of a role with data_scope = 'custom' */
export const role_depts = pgTable(
  'role_depts',
  {
    role_id: integer().notNull(),
    dept_id: integer().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.role_id],
      foreignColumns: [roles.id],
      name: 'role_depts_role_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.dept_id],
      foreignColumns: [departments.id],
      name: 'role_depts_dept_id_fkey',
    }).onDelete('cascade'),
    primaryKey({ columns: [table.role_id, table.dept_id], name: 'role_depts_pkey' }),
  ],
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

// ---- relations (explicit queries only, no implicit lazy loading: roles / menus / children) ----

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

// ---- Types ----

export type AdminUser = typeof admin_users.$inferSelect
export type Role = typeof roles.$inferSelect
export type Menu = typeof menus.$inferSelect
export type Department = typeof departments.$inferSelect

export type RoleWithMenus = Role & { menus: Menu[]; dept_ids?: number[] }
/** User with roles → menus preloaded */
export type AdminUserWithRoles = AdminUser & { roles: RoleWithMenus[] }

// ---- toDict (API output keys and values) ----

export function roleToDict(role: Role | RoleWithMenus, includeMenus = false) {
  const result: Record<string, unknown> = {
    id: role.id,
    name: role.name,
    code: role.code,
    description: role.description,
    created_at: toIso(role.created_at),
  }
  if (includeMenus && 'menus' in role) {
    result.data_scope = role.data_scope
    result.dept_ids = 'dept_ids' in role && Array.isArray(role.dept_ids) ? role.dept_ids : []
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
    nickname: user.nickname,
    email: user.email,
    phone: user.phone,
    avatar: user.avatar,
    status: user.status,
    dept_id: user.dept_id,
    last_login_at: toIso(user.last_login_at),
    last_login_ip: user.last_login_ip,
    totp_enabled: Boolean(user.totp_enabled_at),
    created_at: toIso(user.created_at),
    updated_at: toIso(user.updated_at),
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

/** Menu output (without children); trees with children are assembled by the caller after explicit queries */
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

export function departmentToDict(dept: Department) {
  return {
    id: dept.id,
    parent_id: dept.parent_id,
    name: dept.name,
    code: dept.code,
    leader_id: dept.leader_id,
    sort_order: dept.sort_order,
    status: dept.status,
    created_at: toIso(dept.created_at),
    updated_at: toIso(dept.updated_at),
  }
}
