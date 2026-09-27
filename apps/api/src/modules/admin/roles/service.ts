/**
 * Roles module service layer
 */

import type { EventBus } from '@/common/webhooks'
import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { buildTable, readTableFile, TableFileError, type UploadedFile } from '@/common/tabular'
import type { Db } from '@/db/client'
import { roleToDict, type Menu, type Role } from '@/db/schema'
import { writeError } from '@/common/db-errors'
import { changedFields, exportColumns } from '@/common/validation'
import type { z } from 'zod'
import { RoleRepository } from './repository'
import {
  buildErrorRow,
  EXPORT_FIELD_MAP,
  IMPORT_HEADER_MAP,
  parseCodes,
  parseDataScopeCell,
  TEMPLATE_HEADERS,
  TEMPLATE_ROWS,
  type ErrorRow,
  type RoleExportItem,
  type RoleInput,
  type roleExportBody,
} from './schema'

/** The built-in super admin role (common/rbac.ts short-circuits every check for it) */
const SUPER_ADMIN = 'super_admin'

export class RoleService {
  private readonly repo: RoleRepository

  constructor(
    private readonly db: Db,
    /** Webhook events (role.created / updated / deleted), emitted after the write committed */
    private readonly events?: Pick<EventBus, 'emit'>,
  ) {
    this.repo = new RoleRepository(db)
  }

  /** Run in a transaction: any error rolls back; ServiceError is rethrown as-is, DB input errors become a 400, others a 500 */
  private async inTx<T>(fn: (repo: RoleRepository) => Promise<T>): Promise<T> {
    try {
      return await this.db.transaction((tx) => fn(new RoleRepository(tx)))
    } catch (err) {
      throw writeError(err)
    }
  }


  private async roleDict(repo: RoleRepository, id: number) {
    const role = (await repo.getWithMenus(id))!
    const depts = await repo.deptIdsByRole([id])
    return roleToDict({ ...role, dept_ids: depts.get(id) ?? [] }, true)
  }

  async listRoles() {
    const items = await this.repo.listWithMenus()
    const depts = await this.repo.deptIdsByRole(items.map((r) => r.id))
    return items.map((r) => roleToDict({ ...r, dept_ids: depts.get(r.id) ?? [] }, true))
  }

  /**
   * data_scope / dept_ids from a request body. Returns the scope to store (undefined = unchanged) and the custom
   * departments to store (undefined = unchanged; [] clears them — any scope other than 'custom' keeps none).
   */
  private async resolveDataScope(values: Partial<RoleInput>, current: string) {
    const dataScope = values.data_scope
    const effective = dataScope ?? current
    let deptIds: number[] | undefined
    if (effective !== 'custom') {
      if (dataScope !== undefined) deptIds = []
    } else if (values.dept_ids !== undefined) {
      const wanted = values.dept_ids
      if ((await this.repo.existingDeptIds(wanted)).length !== wanted.length) throw new ServiceError('部门不存在', 400)
      deptIds = wanted
    }
    return { dataScope, deptIds }
  }

  async getRoleOr404(id: number): Promise<Role> {
    const role = await this.repo.getById(id)
    if (!role) throw notFound()
    return role
  }

  async createRole(values: RoleInput) {
    if (await this.repo.getByCode(values.code)) throw new ServiceError('角色编码已存在', 400)

    const menuList = await this.repo.listMenusByIds(values.menu_ids)
    const scope = await this.resolveDataScope(values, 'all')
    const dict = await this.inTx(async (repo) => {
      const created = await repo.insert({
        name: values.name,
        code: values.code,
        description: values.description,
        data_scope: values.data_scope,
      })
      await repo.setMenus(created.id, menuList.map((m) => m.id))
      if (scope.deptIds) await repo.setDepts(created.id, scope.deptIds)
      return this.roleDict(repo, created.id)
    })
    await this.events?.emit('role.created', dict)
    return dict
  }

  /**
   * The super admin role is locked: its code, data scope ('all') and menus (all of them) can't change — changing them
   * would either do nothing (permission checks skip super admins) or lock every super admin out. Name and description
   * stay editable.
   */
  private async assertSuperAdminEdit(role: Role, values: Partial<RoleInput>, menuList: Menu[] | null) {
    if (role.code !== SUPER_ADMIN) return
    if (values.code !== undefined && values.code !== role.code) throw new ServiceError('超级管理员角色的编码不能修改', 400)
    if (values.data_scope !== undefined && values.data_scope !== 'all') throw new ServiceError('超级管理员角色的数据范围固定为全部数据', 400)
    if (menuList) {
      const granted = new Set(menuList.map((m) => m.id))
      if (!(await this.repo.allMenuIds()).every((id) => granted.has(id))) {
        throw new ServiceError('超级管理员角色的菜单权限固定为全部，不能修改', 400)
      }
    }
  }

  async updateRole(role: Role, values: Partial<RoleInput>) {
    if (values.code !== undefined && values.code !== role.code && (await this.repo.getByCode(values.code))) {
      throw new ServiceError('角色编码已存在', 400)
    }
    const changes = changedFields(role, { name: values.name, code: values.code, description: values.description })
    const menuList = values.menu_ids !== undefined ? await this.repo.listMenusByIds(values.menu_ids) : null
    await this.assertSuperAdminEdit(role, values, menuList)
    const scope = await this.resolveDataScope(values, role.data_scope)

    const dict = await this.inTx(async (repo) => {
      await repo.update(role.id, { ...changes, ...(scope.dataScope ? { data_scope: scope.dataScope } : {}) })
      if (menuList) await repo.setMenus(role.id, menuList.map((m) => m.id))
      if (scope.deptIds) await repo.setDepts(role.id, scope.deptIds)
      return this.roleDict(repo, role.id)
    })
    await this.events?.emit('role.updated', dict)
    return dict
  }

  async deleteRole(role: Role) {
    if (role.code === SUPER_ADMIN) throw new ServiceError('超级管理员角色不能删除', 400)
    await this.inTx((repo) => repo.delete(role.id))
    await this.events?.emit('role.deleted', { id: role.id, code: role.code })
    return { message: '删除成功' }
  }

  async exportRoles(options: z.output<typeof roleExportBody>) {
    const validFields = exportColumns(options.fields, EXPORT_FIELD_MAP)

    let items: Role[]
    if (options.export_mode !== 'selected') {
      items = await this.repo.listForExportFiltered(options.filters.search ?? '')
    } else {
      if (options.ids.length === 0) throw new ServiceError('请先勾选要导出的角色数据', 400)
      items = await this.repo.listByIdsOrdered(options.ids)
    }

    let exportItems: RoleExportItem[] = items.map((r) => ({ ...r, menus: [] }))
    if (validFields.some((f) => f === 'menu_codes' || f === 'menu_names')) {
      const byRole = await this.repo.menusByRole(items.map((r) => r.id))
      exportItems = items.map((r) => ({ ...r, menus: byRole.get(r.id) ?? [] }))
    }

    if (validFields.includes('dept_codes')) {
      const codes = await this.repo.deptCodesByRole(exportItems.map((r) => r.id))
      exportItems = exportItems.map((r) => ({ ...r, dept_codes: codes.get(r.id) ?? [] }))
    }

    const headers = validFields.map((f) => EXPORT_FIELD_MAP[f]![0])
    const rows = exportItems.map((item) => validFields.map((f) => EXPORT_FIELD_MAP[f]![1](item)))
    return buildTable(headers, rows, 'roles_export', options.file_type)
  }

  async downloadTemplate(fileTypeRaw: unknown) {
    return buildTable(TEMPLATE_HEADERS, TEMPLATE_ROWS, 'roles_import_template', fileTypeRaw)
  }

  async importRoles(file: UploadedFile | null) {
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
    const mappedFields = [...headerMap.values()]
    if (!mappedFields.includes('name') || !mappedFields.includes('code')) {
      throw new ServiceError('导入文件缺少“角色名称/角色编码”列', 400)
    }

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
        const name = (mapped.name ?? '').trim()
        const code = (mapped.code ?? '').trim()
        const description = (mapped.description ?? '').trim() || null
        const menuCodes = parseCodes(mapped.menu_codes)

        if (!name || !code) {
          errors.push(buildErrorRow(line, '角色名称和编码不能为空', row))
          continue
        }

        const dataScope = parseDataScopeCell(mapped.data_scope)
        if (dataScope === null) {
          errors.push(buildErrorRow(line, '数据范围取值不合法（可填 全部数据 / 本部门及下级 / 本部门 / 仅本人 / 自定义部门）', row))
          continue
        }
        const deptCodes = parseCodes(mapped.dept_codes)
        const depts = await repo.listDeptsByCodes(deptCodes)
        const missingDepts = deptCodes.filter((c) => !depts.some((d) => d.code === c))
        if (missingDepts.length > 0) {
          errors.push(buildErrorRow(line, `部门编码不存在: ${missingDepts.join(', ')}`, row))
          continue
        }

        let menuList: Menu[] = []
        if (menuCodes.length > 0) {
          menuList = await repo.listMenusByCodes(menuCodes)
          const found = new Set(menuList.map((m) => m.code))
          const missing = menuCodes.filter((c) => !found.has(c))
          if (missing.length > 0) {
            errors.push(buildErrorRow(line, `菜单编码不存在: ${missing.join(', ')}`, row))
            continue
          }
        }

        const existing = await repo.getByCode(code)
        if (existing?.code === SUPER_ADMIN && menuCodes.length > 0) {
          errors.push(buildErrorRow(line, '超级管理员角色的菜单权限固定为全部，不能修改', row))
          continue
        }
        if (existing?.code === SUPER_ADMIN && dataScope && dataScope !== 'all') {
          errors.push(buildErrorRow(line, '超级管理员角色的数据范围固定为全部数据', row))
          continue
        }
        // Departments only matter for the custom scope; a blank data scope cell keeps the current scope
        const effectiveScope = dataScope || existing?.data_scope || 'all'
        const deptIds = effectiveScope === 'custom' ? depts.map((d) => d.id) : []
        if (existing) {
          const values: Partial<Pick<Role, 'name' | 'description' | 'data_scope'>> = {}
          if (existing.name !== name) values.name = name
          if (existing.description !== description) values.description = description
          if (dataScope && dataScope !== existing.data_scope) values.data_scope = dataScope
          await repo.update(existing.id, values)
          if (menuCodes.length > 0) await repo.setMenus(existing.id, menuList.map((m) => m.id))
          if (dataScope || deptCodes.length > 0) await repo.setDepts(existing.id, deptIds)
          updated += 1
        } else {
          const createdRole = await repo.insert({ name, code, description, data_scope: effectiveScope })
          await repo.setMenus(createdRole.id, menuList.map((m) => m.id))
          if (deptIds.length > 0) await repo.setDepts(createdRole.id, deptIds)
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
