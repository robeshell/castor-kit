/**
 * 角色模块 service 层
 */

import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { pyStrOrEmpty, pyTruthy } from '@/common/py'
import { buildTable, readTableFile, TableFileError, type UploadedFile } from '@/common/tabular'
import type { Db } from '@/db/client'
import { roleToDict, type Menu, type Role } from '@/db/schema'
import {
  adaptIdsForIn,
  adaptText,
  dictGet,
  internalError,
  parseExportArgs,
  pyEq,
  selectedIdsOrNull,
} from '@/common/py-values'
import { RoleRepository } from './repository'
import {
  buildErrorRow,
  EXPORT_FIELD_MAP,
  IMPORT_HEADER_MAP,
  parseCodes,
  TEMPLATE_HEADERS,
  TEMPLATE_ROWS,
  type ErrorRow,
  type RoleExportItem,
} from './schema'

type Data = Record<string, unknown>

export class RoleService {
  private readonly repo: RoleRepository

  constructor(private readonly db: Db) {
    this.repo = new RoleRepository(db)
  }

  /** 事务执行：任何异常都回滚；ServiceError 原样抛出，其他错误以原错误信息转成 500 */
  private async inTx<T>(fn: (repo: RoleRepository) => Promise<T>): Promise<T> {
    try {
      return await this.db.transaction((tx) => fn(new RoleRepository(tx)))
    } catch (err) {
      if (err instanceof ServiceError) throw err
      throw internalError(err instanceof Error ? err.message : String(err))
    }
  }

  /** `data.get('menu_ids') or []` → `list_menus_by_ids(...)` */
  private async resolveMenus(raw: unknown): Promise<Menu[]> {
    const ids = pyTruthy(raw) ? adaptIdsForIn(raw) : []
    return this.repo.listMenusByIds(ids)
  }

  private async roleDict(repo: RoleRepository, id: number) {
    return roleToDict((await repo.getWithMenus(id))!, true)
  }

  async listRoles() {
    const items = await this.repo.listWithMenusPyOrder()
    return items.map((r) => roleToDict(r, true))
  }

  async getRoleOr404(id: number): Promise<Role> {
    const role = await this.repo.getById(id)
    if (!role) throw notFound()
    return role
  }

  async createRole(data: Data) {
    if (!pyTruthy(data.name)) throw new ServiceError('角色名称不能为空', 400)
    if (!pyTruthy(data.code)) throw new ServiceError('角色编码不能为空', 400)
    // 非字符串 code：按 `roles.code = 5` 查询时 PG 报 operator does not exist → 500
    if (typeof data.code !== 'string') throw internalError('operator does not exist: character varying = non-text')
    if (await this.repo.getByCode(data.code)) throw new ServiceError('角色编码已存在', 400)

    const menuList = 'menu_ids' in data ? await this.resolveMenus(data.menu_ids) : null
    const code = data.code
    return this.inTx(async (repo) => {
      const created = await repo.insert({ name: adaptText(data.name)!, code, description: adaptText(data.description) })
      if (menuList) await repo.setMenus(created.id, menuList.map((m) => m.id))
      return this.roleDict(repo, created.id)
    })
  }

  async updateRole(role: Role, data: Data) {
    const changes: Record<string, unknown> = {}
    for (const field of ['name', 'code', 'description'] as const) {
      if (field in data && !pyEq(data[field], role[field])) changes[field] = data[field]
    }
    const menuList = 'menu_ids' in data ? await this.resolveMenus(data.menu_ids) : null

    return this.inTx(async (repo) => {
      const values = Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, adaptText(v)]))
      await repo.update(role.id, values)
      if (menuList) await repo.setMenus(role.id, menuList.map((m) => m.id))
      return this.roleDict(repo, role.id)
    })
  }

  async deleteRole(role: Role) {
    await this.inTx((repo) => repo.delete(role.id))
    return { message: '删除成功' }
  }

  async exportRoles(data: Data, currentUsername: string | undefined) {
    const args = parseExportArgs(data, EXPORT_FIELD_MAP)

    let items: Role[]
    if (args.exportMode === 'filtered') {
      items = await this.repo.listForExportFiltered(pyStrOrEmpty(dictGet(args.filters, 'search')))
    } else {
      const ids = selectedIdsOrNull(args.ids)
      if (!ids) throw new ServiceError('请先勾选要导出的角色数据', 400)
      items = await this.repo.listByIdsOrdered(adaptIdsForIn(ids))
    }

    // 角色菜单：当前用户的角色复用 currentUserRoleMenus 预加载的集合，其余角色按需单独查询
    let exportItems: RoleExportItem[] = items.map((r) => ({ ...r, menus: [] }))
    if (args.validFields.some((f) => f === 'menu_codes' || f === 'menu_names')) {
      const preloaded = currentUsername ? await this.repo.currentUserRoleMenus(currentUsername) : new Map<number, Menu[]>()
      exportItems = []
      for (const r of items) {
        exportItems.push({ ...r, menus: preloaded.get(r.id) ?? (await this.repo.lazyMenus(r.id)) })
      }
    }

    const headers = args.validFields.map((f) => EXPORT_FIELD_MAP[f]![0])
    const rows = exportItems.map((item) => args.validFields.map((f) => EXPORT_FIELD_MAP[f]![1](item)))
    return buildTable(headers, rows, 'roles_export', args.fileType)
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
        if (existing) {
          const values: Partial<Pick<Role, 'name' | 'description'>> = {}
          if (existing.name !== name) values.name = name
          if (existing.description !== description) values.description = description
          await repo.update(existing.id, values)
          if (menuCodes.length > 0) await repo.setMenus(existing.id, menuList.map((m) => m.id))
          updated += 1
        } else {
          const createdRole = await repo.insert({ name, code, description })
          await repo.setMenus(createdRole.id, menuList.map((m) => m.id))
          created += 1
        }
      }

      if (errors.length > 0) {
        // 抛错让事务整体回滚
        throw new ServiceError('导入失败，存在错误数据', 400, {
          error_rows: errors.slice(0, 500),
          error_count: errors.length,
        })
      }
      return { message: '导入成功', created, updated }
    })
  }
}
