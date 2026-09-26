/**
 * Users module schema layer
 */

import { z } from 'zod'
import { formatDateTime } from '@/common/serialize'
import type { AdminUserWithRoles } from '@/db/schema'

/** Request body: loose + all optional; normalization happens in the service */
export const userBodySchema = z.record(z.string(), z.unknown()).nullish()

/**
 * Data scope declaration (checked by `pnpm verify`): user rows belong to their department, and "own data" means
 * the user themselves.
 */
export const DATA_SCOPE = { deptColumn: 'dept_id', ownerColumn: 'id' } as const

/** A user row plus the department name the service looks up */
export type UserItem = AdminUserWithRoles & { dept_name?: string | null }

export const USER_STATUSES = ['active', 'disabled'] as const
export type UserStatus = (typeof USER_STATUSES)[number]

/** Status labels used in export files and accepted (alongside the codes) on import */
export const STATUS_LABELS: Record<UserStatus, string> = { active: '正常', disabled: '停用' }

export function isUserStatus(value: unknown): value is UserStatus {
  return typeof value === 'string' && (USER_STATUSES as readonly string[]).includes(value)
}

/** Parse an import cell: accepts the code (active / disabled) or the Chinese label; '' means "not given" */
export function parseStatusCell(raw: string): UserStatus | '' | null {
  const text = raw.trim()
  if (!text) return ''
  if (isUserStatus(text)) return text
  const hit = (Object.entries(STATUS_LABELS) as [UserStatus, string][]).find(([, label]) => label === text)
  return hit ? hit[0] : null
}

export const EXPORT_FIELD_MAP: Record<string, [string, (item: UserItem) => unknown]> = {
  id: ['ID', (item) => item.id],
  username: ['用户名', (item) => item.username],
  nickname: ['昵称', (item) => item.nickname ?? ''],
  email: ['邮箱', (item) => item.email ?? ''],
  phone: ['手机', (item) => item.phone ?? ''],
  dept_name: ['部门', (item) => item.dept_name ?? ''],
  status: ['状态', (item) => STATUS_LABELS[item.status as UserStatus] ?? item.status],
  role_names: ['角色名称', (item) => item.roles.map((r) => r.name).join(',')],
  role_codes: ['角色编码', (item) => item.roles.map((r) => r.code).join(',')],
  last_login_at: ['最后登录时间', (item) => formatDateTime(item.last_login_at)],
  last_login_ip: ['最后登录 IP', (item) => item.last_login_ip ?? ''],
  created_at: ['创建时间', (item) => formatDateTime(item.created_at)],
}

export const IMPORT_HEADER_MAP: Record<string, string> = {
  用户名: 'username',
  密码: 'password',
  昵称: 'nickname',
  邮箱: 'email',
  手机: 'phone',
  状态: 'status',
  部门编码: 'dept_code',
  角色编码: 'role_codes',
}

// ---- Profile fields (shared by user management and the self-service profile endpoint) ----

export const PROFILE_FIELDS = ['nickname', 'email', 'phone', 'avatar'] as const
export type ProfileField = (typeof PROFILE_FIELDS)[number]
export type ProfileValues = Partial<Record<ProfileField, string | null>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?[0-9][0-9 -]{4,19}$/
const AVATAR_RE = /^(https?:\/\/|\/)\S+$/
const MAX_LENGTH: Record<ProfileField, number> = { nickname: 100, email: 100, phone: 20, avatar: 500 }
const TOO_LONG: Record<ProfileField, string> = {
  nickname: '昵称不能超过 100 个字符',
  email: '邮箱不能超过 100 个字符',
  phone: '手机号不能超过 20 个字符',
  avatar: '头像地址不能超过 500 个字符',
}

/**
 * Normalize the profile fields present in `data` (absent keys stay absent, so partial updates don't clear them).
 * Blank values become null — email is unique, and '' would collide across users. Returns the values or an error message.
 */
export function normalizeProfile(data: Record<string, unknown>): { values: ProfileValues } | { error: string } {
  const values: ProfileValues = {}
  for (const field of PROFILE_FIELDS) {
    if (!(field in data)) continue
    const raw = data[field]
    const text = raw === null || raw === undefined ? '' : String(raw).trim()
    if (!text) {
      values[field] = null
      continue
    }
    if (text.length > MAX_LENGTH[field]) return { error: TOO_LONG[field] }
    if (field === 'email' && !EMAIL_RE.test(text)) return { error: '邮箱格式不正确' }
    if (field === 'phone' && !PHONE_RE.test(text)) return { error: '手机号格式不正确' }
    if (field === 'avatar' && !AVATAR_RE.test(text)) return { error: '头像地址需以 http(s):// 或 / 开头' }
    values[field] = field === 'email' ? text.toLowerCase() : text
  }
  return { values }
}

export function parseRoleCodes(raw: unknown): string[] {
  if (raw === null || raw === undefined) return []
  const text = String(raw).trim()
  if (!text) return []
  return text
    .replace(/，/g, ',')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export interface ErrorRow {
  line: number
  reason: string
  row: Record<string, string>
}

export function buildErrorRow(line: number, reason: string, row: Record<string, unknown>): ErrorRow {
  return {
    line,
    reason,
    row: Object.fromEntries(Object.entries(row ?? {}).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)])),
  }
}
