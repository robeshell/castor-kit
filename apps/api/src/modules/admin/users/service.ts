/**
 * Users module service layer
 */

import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { generatePasswordHash } from '@/common/password'
import { pyStr, pyTruthy, isPlainObject } from '@/common/py'
import { buildTable, normalizeTableFileType, readTableFile, TableFileError, type UploadedFile } from '@/common/tabular'
import type { Db, Executor } from '@/db/client'
import { adminUserToDict, type AdminUserWithRoles, type Role } from '@/db/schema'
import { UserRepository, type UserFilters } from './repository'
import {
  buildErrorRow,
  EXPORT_FIELD_MAP,
  IMPORT_HEADER_MAP,
  isUserStatus,
  normalizeProfile,
  parseRoleCodes,
  parseStatusCell,
  PROFILE_FIELDS,
  type ErrorRow,
  type ProfileValues,
  type UserStatus,
} from './schema'

type Data = Record<string, unknown>

export interface ImportOptions {
  /** Username of the signed-in admin (can't disable themselves) */
  currentUsername?: string
  /** Whether the caller holds system_users_status; without it a filled-in status cell is an error row */
  canSetStatus: boolean
}

/** Normalize profile fields or throw 400 */
export function profileOrThrow(data: Data): ProfileValues {
  const result = normalizeProfile(data)
  if ('error' in result) throw new ServiceError(result.error, 400)
  return result.values
}

export class UserService {
  private readonly repo: UserRepository

  constructor(private readonly db: Db) {
    this.repo = new UserRepository(db)
  }

  async listUsers(page: number, perPage: number, filters: UserFilters) {
    const { total, items } = await this.repo.listPage(page, perPage, filters)
    return { items: items.map(adminUserToDict), total, page, per_page: perPage }
  }

  async getUserOr404(id: number): Promise<AdminUserWithRoles> {
    const user = await this.repo.getWithRoles(id)
    if (!user) throw notFound()
    return user
  }

  /** Verify all role_ids exist and return the roles; throws on any invalid id */
  private async resolveRoles(repo: UserRepository, roleIdsRaw: unknown): Promise<Role[]> {
    const ids = pyTruthy(roleIdsRaw) ? roleIdsRaw : []
    if (!Array.isArray(ids)) throw new ServiceError('role_ids 必须是数组', 500)
    const numericIds = ids.filter((v): v is number => typeof v === 'number' && Number.isInteger(v))
    const found = await repo.listRolesByIds(numericIds)
    const validIds = new Set(found.map((r) => r.id))
    const missing = ids.filter((rid) => !(typeof rid === 'number' && validIds.has(rid)))
    if (missing.length > 0) throw new ServiceError(`角色不存在: ${pyStr(missing)}`, 400)
    return found
  }

  /** The user is an active super admin and no other active super admin exists (removing them would lock everyone out) */
  private async isLastActiveSuperAdmin(user: AdminUserWithRoles): Promise<boolean> {
    if (user.status !== 'active') return false
    const superAdmin = await this.repo.getRoleByCode('super_admin')
    if (!superAdmin || !user.roles.some((r) => r.id === superAdmin.id)) return false
    return (await this.repo.countOtherActiveUsersWithRole(superAdmin.id, user.id)) === 0
  }

  /** Throws when the email already belongs to another user */
  private async assertEmailFree(repo: UserRepository, email: string | null | undefined, userId?: number) {
    if (!email) return
    const owner = await repo.getByEmail(email)
    if (owner && owner.id !== userId) throw new ServiceError('邮箱已被使用', 400)
  }

  /** Update the signed-in user's own profile (nickname / email / phone / avatar only) */
  async updateOwnProfile(user: AdminUserWithRoles, data: Data) {
    const picked = Object.fromEntries(PROFILE_FIELDS.filter((f) => f in data).map((f) => [f, data[f]]))
    const profile = profileOrThrow(picked)
    await this.assertEmailFree(this.repo, profile.email, user.id)
    const updated = await this.inTx(async (repo) => {
      await repo.updateProfile(user.id, profile)
      return repo.getWithRoles(user.id)
    })
    return { message: '资料已更新', user: adminUserToDict(updated!) }
  }

  private async inTx<T>(fn: (repo: UserRepository, tx: Executor) => Promise<T>): Promise<T> {
    try {
      return await this.db.transaction((tx) => fn(new UserRepository(tx), tx))
    } catch (err) {
      if (err instanceof ServiceError) throw err
      throw new ServiceError(err instanceof Error ? err.message : String(err), 500)
    }
  }

  async createUser(data: Data) {
    if (!pyTruthy(data.username) || !pyTruthy(data.password)) {
      throw new ServiceError('用户名和密码不能为空', 400)
    }
    const username = pyStr(data.username)
    if (await this.repo.getByUsername(username)) throw new ServiceError('用户名已存在', 400)
    const profile = profileOrThrow(data)
    await this.assertEmailFree(this.repo, profile.email)

    const roleIds = 'role_ids' in data ? (await this.resolveRoles(this.repo, data.role_ids)).map((r) => r.id) : null
    const passwordHash = await generatePasswordHash(pyStr(data.password))
    const user = await this.inTx(async (repo) => {
      const created = await repo.insert(username, passwordHash, profile)
      if (roleIds) await repo.setRoles(created.id, roleIds)
      return repo.getWithRoles(created.id)
    })
    return adminUserToDict(user!)
  }

  /** `status` is ignored here: it has its own endpoint and permission (setUserStatus) */
  async updateUser(user: AdminUserWithRoles, data: Data) {
    const profile = profileOrThrow(data)
    await this.assertEmailFree(this.repo, profile.email, user.id)
    const passwordHash = 'password' in data && pyTruthy(data.password) ? await generatePasswordHash(pyStr(data.password)) : null
    const roleIds = 'role_ids' in data ? (await this.resolveRoles(this.repo, data.role_ids)).map((r) => r.id) : null
    const updated = await this.inTx(async (repo) => {
      await repo.updateProfile(user.id, profile)
      if (passwordHash) await repo.updatePasswordHash(user.id, passwordHash)
      if (roleIds) await repo.setRoles(user.id, roleIds)
      return repo.getWithRoles(user.id)
    })
    return adminUserToDict(updated!)
  }

  async setUserStatus(user: AdminUserWithRoles, statusRaw: unknown, currentUsername: string | undefined) {
    if (!isUserStatus(statusRaw)) throw new ServiceError('状态取值不合法', 400)
    if (statusRaw === 'disabled') {
      if (user.username === currentUsername) throw new ServiceError('不能停用当前登录账号', 400)
      if (await this.isLastActiveSuperAdmin(user)) throw new ServiceError('不能停用最后一个超级管理员', 400)
    }
    const updated = await this.inTx(async (repo) => {
      await repo.setStatus(user.id, statusRaw)
      return repo.getWithRoles(user.id)
    })
    return adminUserToDict(updated!)
  }

  async deleteUser(user: AdminUserWithRoles, currentUsername: string | undefined) {
    if (user.username === currentUsername) throw new ServiceError('不能删除当前登录账号', 400)
    if (await this.isLastActiveSuperAdmin(user)) throw new ServiceError('不能删除最后一个超级管理员', 400)
    await this.inTx((repo) => repo.delete(user.id))
    return { message: '删除成功' }
  }

  async exportUsers(data: Data) {
    const ids = pyTruthy(data.ids) ? data.ids : []
    const fields = pyTruthy(data.fields) ? data.fields : []
    const exportMode = pyTruthy(data.export_mode) ? pyStr(data.export_mode).trim() : 'selected'
    const filters = pyTruthy(data.filters) && isPlainObject(data.filters) ? data.filters : {}

    let validFields = Array.isArray(fields) ? fields.filter((f): f is string => typeof f === 'string' && Object.hasOwn(EXPORT_FIELD_MAP, f)) : []
    if (validFields.length === 0) validFields = Object.keys(EXPORT_FIELD_MAP)

    let items: AdminUserWithRoles[]
    if (exportMode === 'filtered') {
      const search = pyTruthy(filters.search) ? pyStr(filters.search).trim() : ''
      const status = isUserStatus(filters.status) ? filters.status : ''
      items = await this.repo.listAllOrdered({ search, status })
    } else {
      if (!Array.isArray(ids) || ids.length === 0) throw new ServiceError('请先勾选要导出的用户数据', 400)
      items = await this.repo.listByIdsOrdered(ids.filter((v): v is number => Number.isInteger(v)))
    }

    const headers = validFields.map((f) => EXPORT_FIELD_MAP[f]![0])
    const rows = items.map((item) => validFields.map((f) => EXPORT_FIELD_MAP[f]![1](item)))
    return buildTable(headers, rows, 'users_export', normalizeTableFileType(data.file_type))
  }

  async downloadTemplate(fileTypeRaw: unknown) {
    return buildTable(
      ['用户名', '密码', '昵称', '邮箱', '手机', '状态', '角色编码'],
      [['demo_user', '123456', '演示用户', 'demo_user@example.com', '13800000000', '正常', 'super_admin']],
      'users_import_template',
      normalizeTableFileType(fileTypeRaw),
    )
  }

  /**
   * Blank cells leave existing values untouched (same as the password and role code columns), so only filled-in profile cells are applied.
   * Returns the row's changes or an error reason.
   */
  private async parseImportRow(
    repo: UserRepository,
    mapped: Record<string, string>,
    username: string,
    existingId: number | undefined,
    options: ImportOptions,
  ): Promise<{ profile: ProfileValues; status: UserStatus | '' } | { error: string }> {
    const filled = Object.fromEntries(PROFILE_FIELDS.filter((f) => (mapped[f] ?? '').trim()).map((f) => [f, mapped[f]]))
    const profile = normalizeProfile(filled)
    if ('error' in profile) return { error: profile.error }
    if (profile.values.email) {
      const owner = await repo.getByEmail(profile.values.email)
      if (owner && owner.id !== existingId) return { error: '邮箱已被使用' }
    }

    const status = parseStatusCell(mapped.status ?? '')
    if (status === null) return { error: '状态取值不合法（可填 正常 / 停用）' }
    if (status && !options.canSetStatus) return { error: '无权限修改用户状态' }
    if (status === 'disabled' && username === options.currentUsername) return { error: '不能停用当前登录账号' }
    return { profile: profile.values, status }
  }

  async importUsers(file: UploadedFile | null, options: ImportOptions = { canSetStatus: false }) {
    if (!file) throw new ServiceError('请上传导入文件', 400)
    let table
    try {
      table = await readTableFile(file)
    } catch (err) {
      if (err instanceof TableFileError) throw new ServiceError(err.message, 400)
      throw err
    }
    if (table.fieldnames.length === 0) throw new ServiceError('导入内容为空', 400)

    const headerMap = new Map<string, string>()
    for (const header of table.fieldnames) {
      const key = (header ?? '').trim()
      if (Object.hasOwn(IMPORT_HEADER_MAP, key)) headerMap.set(header, IMPORT_HEADER_MAP[key]!)
    }
    if (![...headerMap.values()].includes('username')) throw new ServiceError('导入文件缺少“用户名”列', 400)

    return this.inTx(async (repo) => {
      let created = 0
      let updated = 0
      const errors: ErrorRow[] = []
      const superAdmin = await repo.getRoleByCode('super_admin')
      const activeSuperAdminsBefore = superAdmin ? await repo.countActiveUsersWithRole(superAdmin.id) : 0

      for (const [line, row] of table.rows) {
        const mapped: Record<string, string> = {}
        for (const [key, value] of Object.entries(row)) {
          const field = headerMap.get(key)
          if (field) mapped[field] = value
        }
        const username = (mapped.username ?? '').trim()
        const password = (mapped.password ?? '').trim()
        const roleCodes = parseRoleCodes(mapped.role_codes)

        if (!username) {
          errors.push(buildErrorRow(line, '用户名不能为空', row))
          continue
        }

        let rolesFound: Role[] = []
        if (roleCodes.length > 0) {
          rolesFound = await repo.listRolesByCodes(roleCodes)
          const foundCodes = new Set(rolesFound.map((r) => r.code))
          const missingCodes = roleCodes.filter((c) => !foundCodes.has(c))
          if (missingCodes.length > 0) {
            errors.push(buildErrorRow(line, `角色编码不存在: ${missingCodes.join(', ')}`, row))
            continue
          }
        }

        const existing = await repo.getByUsername(username)
        const parsed = await this.parseImportRow(repo, mapped, username, existing?.id, options)
        if ('error' in parsed) {
          errors.push(buildErrorRow(line, parsed.error, row))
          continue
        }
        if (existing) {
          if (password) await repo.updatePasswordHash(existing.id, await generatePasswordHash(password))
          if (roleCodes.length > 0) await repo.setRoles(existing.id, rolesFound.map((r) => r.id))
          await repo.updateProfile(existing.id, parsed.profile)
          if (parsed.status) await repo.setStatus(existing.id, parsed.status)
          updated += 1
        } else {
          if (!password) {
            errors.push(buildErrorRow(line, '新增用户必须提供密码', row))
            continue
          }
          const createdUser = await repo.insert(username, await generatePasswordHash(password), parsed.profile, parsed.status || undefined)
          await repo.setRoles(createdUser.id, rolesFound.map((r) => r.id))
          created += 1
        }
      }

      // Disabling or re-roling rows must not leave nobody able to sign in as super admin
      if (errors.length === 0 && superAdmin && activeSuperAdminsBefore > 0) {
        if ((await repo.countActiveUsersWithRole(superAdmin.id)) === 0) {
          throw new ServiceError('导入后将没有可登录的超级管理员，已取消导入', 400)
        }
      }

      if (errors.length > 0) {
        // Throw so the whole transaction rolls back
        throw new ServiceError('导入失败，存在错误数据', 400, {
          error_rows: errors.slice(0, 500),
          error_count: errors.length,
        })
      }
      return { message: '导入成功', created, updated }
    })
  }
}
