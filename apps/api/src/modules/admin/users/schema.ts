/**
 * 用户模块 schema 层（对齐 AuraStack backend/app/admin/schema/users.py）
 */

import { z } from 'zod'
import { formatDateTime } from '@/common/serialize'
import type { AdminUserWithRoles } from '@/db/schema'

/** 移植期请求体：loose + 全可选，归一化在 service 里做 */
export const userBodySchema = z.record(z.string(), z.unknown()).nullish()

export const EXPORT_FIELD_MAP: Record<string, [string, (item: AdminUserWithRoles) => unknown]> = {
  id: ['ID', (item) => item.id],
  username: ['用户名', (item) => item.username],
  role_names: ['角色名称', (item) => item.roles.map((r) => r.name).join(',')],
  role_codes: ['角色编码', (item) => item.roles.map((r) => r.code).join(',')],
  created_at: ['创建时间', (item) => formatDateTime(item.created_at)],
}

export const IMPORT_HEADER_MAP: Record<string, string> = {
  用户名: 'username',
  密码: 'password',
  角色编码: 'role_codes',
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
