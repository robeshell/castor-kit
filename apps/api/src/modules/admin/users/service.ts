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
import { UserRepository } from './repository'
import { buildErrorRow, EXPORT_FIELD_MAP, IMPORT_HEADER_MAP, parseRoleCodes, type ErrorRow } from './schema'

type Data = Record<string, unknown>

export class UserService {
  private readonly repo: UserRepository

  constructor(private readonly db: Db) {
    this.repo = new UserRepository(db)
  }

  async listUsers(page: number, perPage: number, search: string) {
    const { total, items } = await this.repo.listPage(page, perPage, search)
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

  private async isLastSuperAdmin(user: AdminUserWithRoles): Promise<boolean> {
    const superAdmin = await this.repo.getRoleByCode('super_admin')
    if (!superAdmin || !user.roles.some((r) => r.id === superAdmin.id)) return false
    return (await this.repo.countOtherUsersWithRole(superAdmin.id, user.id)) === 0
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

    const roleIds = 'role_ids' in data ? (await this.resolveRoles(this.repo, data.role_ids)).map((r) => r.id) : null
    const passwordHash = await generatePasswordHash(pyStr(data.password))
    const user = await this.inTx(async (repo) => {
      const created = await repo.insert(username, passwordHash)
      if (roleIds) await repo.setRoles(created.id, roleIds)
      return repo.getWithRoles(created.id)
    })
    return adminUserToDict(user!)
  }

  async updateUser(user: AdminUserWithRoles, data: Data) {
    const passwordHash = 'password' in data && pyTruthy(data.password) ? await generatePasswordHash(pyStr(data.password)) : null
    const roleIds = 'role_ids' in data ? (await this.resolveRoles(this.repo, data.role_ids)).map((r) => r.id) : null
    const updated = await this.inTx(async (repo) => {
      if (passwordHash) await repo.updatePasswordHash(user.id, passwordHash)
      if (roleIds) await repo.setRoles(user.id, roleIds)
      return repo.getWithRoles(user.id)
    })
    return adminUserToDict(updated!)
  }

  async deleteUser(user: AdminUserWithRoles, currentUsername: string | undefined) {
    if (user.username === currentUsername) throw new ServiceError('不能删除当前登录账号', 400)
    if (await this.isLastSuperAdmin(user)) throw new ServiceError('不能删除最后一个超级管理员', 400)
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
      items = await this.repo.listAllOrdered(search)
    } else {
      if (!Array.isArray(ids) || ids.length === 0) throw new ServiceError('请先勾选要导出的用户数据', 400)
      items = await this.repo.listByIdsOrdered(ids.filter((v): v is number => Number.isInteger(v)))
    }

    const headers = validFields.map((f) => EXPORT_FIELD_MAP[f]![0])
    const rows = items.map((item) => validFields.map((f) => EXPORT_FIELD_MAP[f]![1](item)))
    return buildTable(headers, rows, 'users_export', normalizeTableFileType(data.file_type))
  }

  async downloadTemplate(fileTypeRaw: unknown) {
    return buildTable(['用户名', '密码', '角色编码'], [['demo_user', '123456', 'super_admin']], 'users_import_template', normalizeTableFileType(fileTypeRaw))
  }

  async importUsers(file: UploadedFile | null) {
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
        if (existing) {
          if (password) await repo.updatePasswordHash(existing.id, await generatePasswordHash(password))
          if (roleCodes.length > 0) await repo.setRoles(existing.id, rolesFound.map((r) => r.id))
          updated += 1
        } else {
          if (!password) {
            errors.push(buildErrorRow(line, '新增用户必须提供密码', row))
            continue
          }
          const createdUser = await repo.insert(username, await generatePasswordHash(password))
          await repo.setRoles(createdUser.id, rolesFound.map((r) => r.id))
          created += 1
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
