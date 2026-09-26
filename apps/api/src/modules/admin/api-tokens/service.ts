/**
 * API tokens module service layer: users manage their own tokens (profile), admins list and revoke all of them
 */

import { sql } from 'drizzle-orm'
import { collectMenuCodes, isSuperAdmin } from '@/common/rbac'
import { type DataScope } from '@/common/data-scope'
import { newApiToken } from '@/common/api-token'
import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import type { SettingsStore } from '@/common/settings'
import type { Db } from '@/db/client'
import { apiTokenToDict, type AdminUserWithRoles } from '@/db/schema'
import { utcNow } from '@/db/schema/columns'
import { ApiTokenRepository, type TokenFilters } from './repository'

type Data = Record<string, unknown>

/** Active tokens one user may hold */
export const MAX_ACTIVE_TOKENS = 20
const MAX_DAYS = 3650

export class ApiTokenService {
  private readonly repo: ApiTokenRepository

  constructor(
    db: Db,
    private readonly settings: SettingsStore,
  ) {
    this.repo = new ApiTokenRepository(db)
  }

  private async enabled(): Promise<boolean> {
    return this.settings.isAvailable('security.api_tokens_enabled', await this.settings.get())
  }

  async listOwn(user: AdminUserWithRoles) {
    const items = await this.repo.listOwn(user.id)
    return { enabled: await this.enabled(), items: items.map(apiTokenToDict) }
  }

  /**
   * What the user may grant: the menus and buttons they hold (every active one for a super admin), plus the
   * directories above them so the page can show a tree
   */
  async scopeOptions(user: AdminUserWithRoles) {
    const all = await this.repo.activeMenus()
    const held = isSuperAdmin(user) ? new Set(all.map((m) => m.code)) : new Set(collectMenuCodes(user))
    const byId = new Map(all.map((m) => [m.id, m]))
    const keep = new Set<number>()
    for (const m of all) {
      if (!held.has(m.code)) continue
      for (let cur: typeof m | undefined = m; cur && !keep.has(cur.id); cur = cur.parent_id ? byId.get(cur.parent_id) : undefined) keep.add(cur.id)
    }
    return {
      items: all
        .filter((m) => keep.has(m.id))
        .map((m) => ({ id: m.id, parent_id: m.parent_id, code: m.code, name: m.name, menu_type: m.menu_type, grantable: held.has(m.code) })),
    }
  }

  /** Create a token for the user; the plain text is returned this once only */
  async create(user: AdminUserWithRoles, data: Data) {
    if (!(await this.enabled())) throw new ServiceError('API Token 未开启', 400)
    const name = typeof data.name === 'string' ? data.name.trim() : ''
    if (!name || name.length > 100) throw new ServiceError('请填写名称（最多 100 个字符）', 400)
    const scopes = Array.isArray(data.scopes) ? [...new Set(data.scopes.filter((s): s is string => typeof s === 'string'))] : []
    if (scopes.length === 0) throw new ServiceError('请至少选择一项权限', 400)
    const held = isSuperAdmin(user) ? null : new Set(collectMenuCodes(user))
    const options = new Set((await this.repo.activeMenus()).map((m) => m.code))
    const outside = scopes.filter((s) => !options.has(s) || (held !== null && !held.has(s)))
    if (outside.length > 0) throw new ServiceError(`不能授予自己没有的权限：${outside.join(', ')}`, 400)
    const days = data.expires_in_days
    if (days !== null && !(typeof days === 'number' && Number.isInteger(days) && days >= 1 && days <= MAX_DAYS)) {
      throw new ServiceError('有效期不合法', 400)
    }
    if ((await this.repo.countActiveOwn(user.id)) >= MAX_ACTIVE_TOKENS) {
      throw new ServiceError(`每人最多 ${MAX_ACTIVE_TOKENS} 个有效的 API Token，请先吊销不用的`, 400)
    }
    const { token, prefix, hash } = newApiToken()
    const expiresAt = days === null ? null : sql`${utcNow()} + make_interval(days => ${days})`
    const row = await this.repo.insert({ name, token_prefix: prefix, token_hash: hash, scopes, expires_at: expiresAt, created_by: user.id })
    return { token, item: apiTokenToDict({ ...row, creator_username: user.username, creator_nickname: user.nickname }) }
  }

  async revokeOwn(user: AdminUserWithRoles, id: number) {
    const row = await this.repo.getById(id)
    if (!row || row.created_by !== user.id) throw notFound()
    await this.repo.revoke(id)
    return { message: '已吊销' }
  }

  async list(page: number, perPage: number, filters: TokenFilters, scope: DataScope) {
    const { total, items } = await this.repo.listPage(page, perPage, filters, scope)
    return { items: items.map(apiTokenToDict), total, page, per_page: perPage }
  }

  /** Admin revoke; only super admins can revoke a super admin's token */
  async revoke(id: number, scope: DataScope, caller: AdminUserWithRoles, loadCreator: (id: number) => Promise<AdminUserWithRoles | null>) {
    const row = await this.repo.getById(id, scope)
    if (!row) throw notFound()
    if (!isSuperAdmin(caller) && row.created_by !== caller.id) {
      const creator = await loadCreator(row.created_by)
      if (creator && isSuperAdmin(creator)) throw new ServiceError('只有超级管理员可以操作超级管理员账号', 403)
    }
    await this.repo.revoke(id)
    return { message: '已吊销' }
  }
}
