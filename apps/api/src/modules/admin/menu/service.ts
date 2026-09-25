/**
 * Menu module service layer
 */

import { wouldCreateCycle } from '@/common/tree'
import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { pyStrOrEmpty, pyTruthy } from '@/common/py'
import { buildTable, readTableFile, TableFileError, type UploadedFile } from '@/common/tabular'
import type { Db, Executor } from '@/db/client'
import { menuToDict, type AdminUserWithRoles, type Menu, type MenuDict } from '@/db/schema'
import {
  adaptBool,
  adaptIdsForIn,
  adaptInt,
  adaptText,
  dbErrorMentions,
  dictGet,
  internalError,
  parseExportArgs,
  pyEq,
  selectedIdsOrNull,
} from '@/common/py-values'
import { MenuRepository, type MenuUpdateValues, type NewMenuValues } from './repository'
import {
  buildErrorRow,
  EXPORT_FIELD_MAP,
  MENU_MUTABLE_FIELDS,
  MENU_TYPES,
  mapImportHeaders,
  parseImportRow,
  TEMPLATE_HEADERS,
  TEMPLATE_ROWS,
  validateCreatePayload,
  validateUpdatePayload,
  type ErrorRow,
  type MenuExportItem,
  type MenuMutableField,
} from './schema'

type Data = Record<string, unknown>

const TEXT_FIELDS = new Set<MenuMutableField>(['name', 'code', 'icon', 'path', 'component', 'menu_type', 'description'])
const INT_FIELDS = new Set<MenuMutableField>(['parent_id', 'sort_order'])

/** Convert raw request-body values to DB values by column type (invalid values → 500) */
function adaptField(field: MenuMutableField, value: unknown): unknown {
  if (TEXT_FIELDS.has(field)) return adaptText(value)
  if (INT_FIELDS.has(field)) return adaptInt(value)
  return adaptBool(value)
}

/** Fields updated per row on import (parent_id is handled separately in the second pass) */
const IMPORT_FIELDS = [
  'name',
  'menu_type',
  'path',
  'component',
  'icon',
  'sort_order',
  'is_visible',
  'is_active',
  'description',
] as const
type ImportFields = Pick<Menu, (typeof IMPORT_FIELDS)[number] | 'code' | 'parent_id'>

interface ImportState {
  /** Current DB row (new items only have one after insert) */
  original: Menu | null
  current: ImportFields
}

export class MenuService {
  private readonly repo: MenuRepository

  constructor(private readonly db: Db) {
    this.repo = new MenuRepository(db)
  }

  private async inTx<T>(fn: (repo: MenuRepository, tx: Executor) => Promise<T>): Promise<T> {
    try {
      return await this.db.transaction((tx) => fn(new MenuRepository(tx), tx))
    } catch (err) {
      if (err instanceof ServiceError) throw err
      throw internalError(err instanceof Error ? err.message : String(err))
    }
  }

  /** `Menu.to_dict(include_children=True)`: children are queried level by level, ordered by sort_order */
  private async toDictWithChildren(menu: Menu, visiting: Set<number> = new Set()): Promise<MenuDict> {
    // A parent_id pointing to itself / forming a cycle is treated as too-deep recursion → 500
    if (visiting.has(menu.id)) throw internalError('maximum recursion depth exceeded')
    visiting.add(menu.id)
    const dict = menuToDict(menu)
    const children: MenuDict[] = []
    for (const child of await this.repo.listChildrenPyOrder(menu.id)) {
      children.push(await this.toDictWithChildren(child, visiting))
    }
    dict.children = children
    visiting.delete(menu.id)
    return dict
  }

  async listMenus(formatType: string, search: string): Promise<MenuDict[]> {
    if (formatType === 'tree') {
      if (search) return this.searchTree(search)
      const roots = await this.repo.listRoots('')
      const result: MenuDict[] = []
      for (const root of roots) result.push(await this.toDictWithChildren(root))
      return result
    }
    return (await this.repo.listFlat(search)).map(menuToDict)
  }

  /**
   * Tree search (not just filtering root nodes, otherwise submenus could never be found):
   * keep matched nodes and their ancestor paths; a matched node's subtree is returned in full, ancestors keep only the branches leading to matches.
   */
  private async searchTree(search: string): Promise<MenuDict[]> {
    const matched = new Set((await this.repo.listFlat(search)).map((m) => m.id))
    if (matched.size === 0) return []
    const parentOf = new Map((await this.repo.listFlat('')).map((m) => [m.id, m.parent_id]))
    const keep = new Set<number>()
    for (const id of matched) {
      // Walk up to fill in ancestors; `visited` prevents an infinite loop if the DB already contains a cycle
      let cur: number | null | undefined = id
      while (cur != null && !keep.has(cur)) {
        keep.add(cur)
        cur = parentOf.get(cur)
      }
    }

    const build = async (menu: Menu): Promise<MenuDict> => {
      if (matched.has(menu.id)) return this.toDictWithChildren(menu)
      const dict = menuToDict(menu)
      const children: MenuDict[] = []
      for (const child of await this.repo.listChildrenPyOrder(menu.id)) {
        if (keep.has(child.id)) children.push(await build(child))
      }
      dict.children = children
      return dict
    }

    const result: MenuDict[] = []
    for (const root of await this.repo.listRoots('')) {
      if (keep.has(root.id)) result.push(await build(root))
    }
    return result
  }

  async getMenuOr404(id: number): Promise<Menu> {
    const menu = await this.repo.getById(id)
    if (!menu) throw notFound()
    return menu
  }

  async getMenuDetail(menu: Menu): Promise<MenuDict> {
    return this.toDictWithChildren(menu)
  }

  /** `build_menu_entity`: columns whose value is None fall back to the model default */
  private buildMenuValues(data: Data, code: string): NewMenuValues {
    return {
      name: adaptText(data.name)!,
      code,
      icon: adaptText(data.icon),
      path: adaptText(data.path),
      component: adaptText(data.component),
      parent_id: adaptInt(data.parent_id),
      sort_order: adaptInt('sort_order' in data ? data.sort_order : 0) ?? 0,
      is_visible: adaptBool('is_visible' in data ? data.is_visible : true) ?? true,
      is_active: adaptBool('is_active' in data ? data.is_active : true) ?? true,
      menu_type: adaptText('menu_type' in data ? data.menu_type : 'menu') ?? 'menu',
      description: adaptText(data.description),
    }
  }

  private async insertWithSequenceSync(data: Data, code: string): Promise<Menu> {
    return this.db.transaction(async (tx) => {
      const repo = new MenuRepository(tx)
      await repo.syncIdSequence()
      return repo.insert(this.buildMenuValues(data, code))
    })
  }

  async createMenu(data: Data): Promise<MenuDict> {
    validateCreatePayload(data)
    // Non-string code: querying `menus.code = 5` makes PG raise operator does not exist → 500
    if (typeof data.code !== 'string') throw internalError('operator does not exist: character varying = non-text')
    const code = data.code
    if (await this.repo.getByCode(code)) throw new ServiceError(`菜单编码 ${code} 已存在`, 400)

    try {
      return menuToDict(await this.insertWithSequenceSync(data, code))
    } catch (err) {
      if (err instanceof ServiceError) throw err
      if (dbErrorMentions(err, 'menus_pkey')) {
        try {
          return menuToDict(await this.insertWithSequenceSync(data, code))
        } catch (retryErr) {
          if (retryErr instanceof ServiceError) throw retryErr
          throw internalError(retryErr instanceof Error ? retryErr.message : String(retryErr))
        }
      }
      throw internalError(err instanceof Error ? err.message : String(err))
    }
  }

  async updateMenu(menu: Menu, data: Data): Promise<MenuDict> {
    validateUpdatePayload(data)
    if (pyTruthy(data.code) && !pyEq(data.code, menu.code)) {
      if (typeof data.code !== 'string') throw internalError('operator does not exist: character varying = non-text')
      if (await this.repo.getByCode(data.code)) throw new ServiceError(`菜单编码 ${data.code} 已存在`, 400)
    }

    // Only UPDATE columns whose value actually changed; if nothing changed no UPDATE is sent and updated_at stays
    const changed = MENU_MUTABLE_FIELDS.filter((f) => f in data && !pyEq(data[f], menu[f]))
    if (changed.length === 0) return menuToDict(menu)

    return this.inTx(async (repo, tx) => {
      const values = Object.fromEntries(changed.map((f) => [f, adaptField(f, data[f])])) as MenuUpdateValues
      // Design note: making a menu its own parent or a descendant's child creates a cycle; the menu tree API then recurses forever (500) and both menu management and the sidebar break, so block it here
      const newParent = values.parent_id
      if (typeof newParent === 'number' && (await wouldCreateCycle(tx, 'menus', menu.id, newParent))) {
        throw new ServiceError('父级菜单不能是自身或其子菜单', 400)
      }
      return menuToDict(await repo.update(menu.id, values))
    })
  }

  async deleteMenu(menu: Menu) {
    if ((await this.repo.countChildren(menu.id)) > 0) throw new ServiceError('该菜单下还有子菜单，无法删除', 400)
    await this.inTx((repo) => repo.delete(menu.id))
    return { message: '删除成功' }
  }

  async sortMenu(menu: Menu, directionRaw: unknown) {
    const direction = pyStrOrEmpty(directionRaw).toLowerCase()
    if (direction !== 'up' && direction !== 'down') throw new ServiceError('direction 参数必须是 up 或 down', 400)

    const siblings = await this.repo.listSiblings(menu.parent_id)
    if (siblings.length <= 1) return { message: '当前层级只有一个菜单，无需排序', changed: false }

    const idList = siblings.map((m) => m.id)
    const idx = idList.indexOf(menu.id)
    if (idx === -1) return { message: '菜单不存在于当前层级', changed: false }

    if (direction === 'up') {
      if (idx === 0) return { message: '当前菜单已在最前', changed: false }
      ;[idList[idx - 1], idList[idx]] = [idList[idx]!, idList[idx - 1]!]
    } else {
      if (idx === idList.length - 1) return { message: '当前菜单已在最后', changed: false }
      ;[idList[idx + 1], idList[idx]] = [idList[idx]!, idList[idx + 1]!]
    }

    const byId = new Map(siblings.map((m) => [m.id, m]))
    await this.inTx(async (repo) => {
      for (const [i, id] of idList.entries()) {
        const order = (i + 1) * 10
        if (byId.get(id)!.sort_order !== order) await repo.update(id, { sort_order: order })
      }
    })
    return { message: '排序成功', changed: true }
  }

  /**
   * Menu tree visible to the current user. Note (preserves existing API behavior):
   * - no super_admin short-circuit; only menus actually assigned to the user's roles count
   * - only active and visible menus are starting points; their ancestors are added unconditionally
   * - leaf nodes have no children key (not children: [])
   */
  async getMyMenus(user: AdminUserWithRoles | null): Promise<MenuDict[]> {
    if (!user) return []

    const seedIds = new Set<number>()
    for (const role of user.roles) {
      for (const menu of role.menus) {
        if (menu.is_active && menu.is_visible) seedIds.add(menu.id)
      }
    }
    if (seedIds.size === 0) return []

    const ids = await this.repo.listIdsWithAncestors([...seedIds])
    const menus = await this.repo.listByIdsOrdered(ids)

    const byId = new Map<number, MenuDict>(menus.map((m) => [m.id, menuToDict(m)]))
    for (const menu of menus) {
      if (menu.parent_id && byId.has(menu.parent_id)) {
        const parent = byId.get(menu.parent_id)!
        ;(parent.children ??= []).push(byId.get(menu.id)!)
      }
    }
    return menus.filter((m) => !m.parent_id).map((m) => byId.get(m.id)!)
  }

  async exportMenus(data: Data) {
    const args = parseExportArgs(data, EXPORT_FIELD_MAP)

    let items: Menu[]
    if (args.exportMode === 'filtered') {
      items = await this.repo.listForExportFiltered(pyStrOrEmpty(dictGet(args.filters, 'search')))
    } else {
      const ids = selectedIdsOrNull(args.ids)
      if (!ids) throw new ServiceError('请先勾选要导出的菜单数据', 400)
      items = await this.repo.listByIdsOrdered(adaptIdsForIn(ids))
    }

    const parentIds = [...new Set(items.map((m) => m.parent_id).filter((id): id is number => id !== null))]
    const parentCodes = await this.repo.mapCodesByIds(parentIds)
    const exportItems: MenuExportItem[] = items.map((m) => ({
      ...m,
      parent_code: m.parent_id !== null ? (parentCodes.get(m.parent_id) ?? null) : null,
    }))

    const headers = args.validFields.map((f) => EXPORT_FIELD_MAP[f]![0])
    const rows = exportItems.map((item) => args.validFields.map((f) => EXPORT_FIELD_MAP[f]![1](item)))
    return buildTable(headers, rows, 'menus_export', args.fileType)
  }

  async downloadTemplate(fileTypeRaw: unknown) {
    return buildTable(TEMPLATE_HEADERS, TEMPLATE_ROWS, 'menus_import_template', fileTypeRaw)
  }

  async importMenus(file: UploadedFile | null) {
    if (!file) throw new ServiceError('请上传导入文件', 400)
    let table
    try {
      table = await readTableFile(file)
    } catch (err) {
      if (err instanceof TableFileError) throw new ServiceError(err.message, 400)
      throw err
    }
    if (table.fieldnames.length === 0) throw new ServiceError('导入内容为空', 400)

    const headerMap = mapImportHeaders(table.fieldnames)
    const mappedFields = [...headerMap.values()]
    if (!mappedFields.includes('name') || !mappedFields.includes('code')) {
      throw new ServiceError('导入文件缺少“菜单名称/菜单编码”列', 400)
    }

    return this.inTx(async (repo) => {
      let created = 0
      let updated = 0
      const errors: ErrorRow[] = []
      const cache = new Map<string, ImportState>(
        (await repo.listAll()).map((m) => [m.code, { original: m, current: { ...m } }]),
      )
      const newStates: ImportState[] = []
      const pending: [ImportState, string, number, Record<string, string>][] = []

      for (const [line, row] of table.rows) {
        const mapped: Record<string, string> = {}
        for (const [key, value] of Object.entries(row)) {
          const field = headerMap.get(key)
          if (field) mapped[field] = value
        }

        const parsed = parseImportRow(mapped)
        if (!parsed.name || !parsed.code) {
          errors.push(buildErrorRow(line, '菜单名称和编码不能为空', row))
          continue
        }
        if (!MENU_TYPES.has(parsed.menu_type)) {
          errors.push(buildErrorRow(line, `类型无效: ${parsed.menu_type}`, row))
          continue
        }

        let state = cache.get(parsed.code)
        if (state) {
          updated += 1
        } else {
          state = { original: null, current: { code: parsed.code, parent_id: null } as ImportFields }
          cache.set(parsed.code, state)
          newStates.push(state)
          created += 1
        }
        for (const field of IMPORT_FIELDS) (state.current as Record<string, unknown>)[field] = parsed[field]
        pending.push([state, parsed.parent_code, line, row])
      }

      // flush: existing menus only update changed columns; new menus are inserted in file order (parent_id still empty at this point)
      for (const state of cache.values()) {
        if (!state.original) continue
        const changed = IMPORT_FIELDS.filter((f) => state.current[f] !== state.original![f])
        if (changed.length > 0) {
          state.original = await repo.update(
            state.original.id,
            Object.fromEntries(changed.map((f) => [f, state.current[f]])) as MenuUpdateValues,
          )
        }
      }
      for (const state of newStates) {
        state.original = await repo.insert({ ...state.current, parent_id: null })
      }

      for (const [state, parentCode, line, row] of pending) {
        if (!parentCode) {
          state.current.parent_id = null
          continue
        }
        const parent = cache.get(parentCode)
        if (!parent) {
          errors.push(buildErrorRow(line, `父级编码不存在: ${parentCode}`, row))
          continue
        }
        if (parent.current.code === state.current.code) {
          errors.push(buildErrorRow(line, '父级编码不能等于自身编码', row))
          continue
        }
        state.current.parent_id = parent.original!.id
      }

      // Design note: check for cycles (A→B, B→A, etc.) using the final parent/child relations after import; cyclic rows are recorded as errors and the whole batch rolls back
      const parentOf = new Map<number, number | null>()
      for (const st of cache.values()) if (st.original) parentOf.set(st.original.id, st.current.parent_id ?? null)
      for (const [state, parentCode, line, row] of pending) {
        const start = state.original!.id
        let cur = state.current.parent_id ?? null
        for (let steps = 0; cur !== null && steps <= parentOf.size; steps += 1) {
          if (cur === start) {
            errors.push(buildErrorRow(line, `父级编码 ${parentCode} 会导致成环`, row))
            break
          }
          cur = parentOf.get(cur) ?? null
        }
      }

      if (errors.length > 0) {
        // Throw so the whole transaction rolls back
        throw new ServiceError('导入失败，存在错误数据', 400, {
          error_rows: errors.slice(0, 500),
          error_count: errors.length,
        })
      }

      for (const state of new Set(pending.map(([s]) => s))) {
        if (state.current.parent_id !== state.original!.parent_id) {
          await repo.update(state.original!.id, { parent_id: state.current.parent_id })
        }
      }
      return { message: '导入成功', created, updated }
    })
  }
}
