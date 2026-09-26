/**
 * System settings module service layer: read and save the registry in common/settings.ts
 */

import { inArray } from 'drizzle-orm'
import { ServiceError } from '@/common/errors'
import { SettingValidationError, type SettingsStore } from '@/common/settings'
import type { Db } from '@/db/client'
import { roles } from '@/db/schema'

export class SettingsService {
  constructor(
    private readonly db: Db,
    private readonly store: SettingsStore,
  ) {}

  list() {
    return this.store.describe().then((items) => ({ items }))
  }

  /** Save the given { key: value } pairs; role codes in totp_required_roles must exist */
  async update(values: unknown, userId: number | null) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) throw new ServiceError('请提交要保存的设置', 400)
    const changes = values as Record<string, unknown>
    const required = changes['security.totp_required_roles']
    if (Array.isArray(required) && required.length > 0) {
      const codes = required.filter((c): c is string => typeof c === 'string')
      const found = await this.db.select({ code: roles.code }).from(roles).where(inArray(roles.code, codes))
      const missing = codes.filter((c) => !found.some((r) => r.code === c))
      if (missing.length > 0) throw new ServiceError(`角色编码不存在: ${missing.join(', ')}`, 400)
    }
    try {
      await this.store.update(changes, userId)
    } catch (err) {
      if (err instanceof SettingValidationError) throw new ServiceError(err.message, 400)
      throw err
    }
    return this.list()
  }
}
