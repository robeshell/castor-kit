/**
 * Sessions module service layer: online users (在线用户) and the profile's signed-in devices
 */

import { loadAdminsWithRolesByIds } from '@/common/auth'
import { UNRESTRICTED, type DataScope } from '@/common/data-scope'
import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { isSuperAdmin } from '@/common/rbac'
import { revokeSessions } from '@/common/session'
import type { Executor } from '@/db/client'
import { sessionToDict } from '@/db/schema'
import { SessionRepository, type SessionFilters } from './repository'

const KEY_PATTERN = /^[0-9a-f]{16}$/

export interface SessionCaller {
  userId: number
  superAdmin: boolean
  /** The caller's own session id (can't be revoked here: that is logging out) */
  currentSessionId: string
}

export class SessionService {
  private readonly repo: SessionRepository

  constructor(private readonly db: Executor) {
    this.repo = new SessionRepository(db)
  }

  async list(page: number, perPage: number, filters: SessionFilters, scope: DataScope, currentSessionId: string) {
    const { total, items } = await this.repo.listPage(page, perPage, filters, scope)
    return { items: items.map((row) => sessionToDict(row, currentSessionId)), total, page, per_page: perPage }
  }

  /** Force a session to sign out; `own` limits it to the caller's sessions (profile) */
  async revoke(key: string, caller: SessionCaller, scope: DataScope, own = false) {
    if (!KEY_PATTERN.test(key)) throw notFound()
    const row = await this.repo.findByKey(key, { search: '', userId: own ? caller.userId : undefined }, own ? UNRESTRICTED : scope)
    if (!row) throw notFound()
    if (row.id === caller.currentSessionId) throw new ServiceError('不能下线当前会话，请直接退出登录', 400)
    if (!own && !caller.superAdmin && row.user_id !== caller.userId) {
      const [target] = await loadAdminsWithRolesByIds(this.db, [row.user_id])
      if (target && isSuperAdmin(target)) throw new ServiceError('只有超级管理员可以操作超级管理员账号', 403)
    }
    await revokeSessions(this.db, { id: row.id })
    return { message: '已下线' }
  }

  /** Sign out every other session of the caller */
  async revokeOthers(caller: SessionCaller) {
    const revoked = await revokeSessions(this.db, { userId: caller.userId, exceptId: caller.currentSessionId })
    return { message: '已下线其他设备', revoked }
  }
}
