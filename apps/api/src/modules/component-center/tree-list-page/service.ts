/**
 * Tree list page service layer
 *
 * Write behavior notes:
 * - Updates write only columns that actually changed; with no changes no UPDATE is sent and updated_at stays the same (onupdate semantics)
 * - On edit, the parent-validation query first autoflushes fields already assigned (so DB errors surface before the "parent not found" error)
 * - On delete, children have their parent_id cleared first (see repository.deleteWithChildrenDetached)
 * - Import persistence timing: a row's write is persisted to the DB only right before the next row's get_by_code query, and the last row on commit;
 *   if any row has errors everything is rolled back, so unpersisted writes never trigger DB errors
 */

import { wouldCreateCycle } from '@/common/tree'
import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { isPlainObject, pyStr, pyStrOrEmpty, pyTruthy } from '@/common/py'
import { buildTable, normalizeTableFileType, readTableFile, TableFileError, type UploadedFile } from '@/common/tabular'
import type { Db } from '@/db/client'
import { treeNodeToDict, type TreeNode } from '@/db/schema'
import { TreeListPageRepository, type TreeListFilters, type TreeNodeUpdate } from './repository'
import {
  buildErrorRow,
  EXPORT_FIELD_MAP,
  IMPORT_HEADER_MAP,
  isExportField,
  parseBool,
  parseInt,
  pyIterate,
  resolveIdList,
  STATUS_VALUES,
  TEMPLATE_HEADERS,
  TEMPLATE_ROWS,
  tryInt,
  type ErrorRow,
} from './schema'

type Data = Record<string, unknown>
type TreeDict = ReturnType<typeof treeNodeToDict> & { children: TreeDict[]; children_count: number }

function has(data: Data, key: string): boolean {
  return Object.hasOwn(data, key)
}

/** `str(x or '').strip() or None` */
function strOrNone(value: unknown): string | null {
  return pyStrOrEmpty(value) || null
}

/** `str(x or 'category').strip() or 'category'` / `str(x or '').strip() or 'category'` (both yield the same result) */
function nodeTypeOf(value: unknown): string {
  return pyStrOrEmpty(value) || 'category'
}

/** Keep only columns that differ from the current row (equal values don't count as changes) */
function changedValues(item: TreeNode, next: TreeNodeUpdate): TreeNodeUpdate {
  const changes: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined) continue
    if ((item as Record<string, unknown>)[key] !== value) changes[key] = value
  }
  return changes as TreeNodeUpdate
}

export class TreeListPageService {
  private readonly repo: TreeListPageRepository

  constructor(private readonly db: Db) {
    this.repo = new TreeListPageRepository(db)
  }

  static normalizeStatus(value: unknown, fallback = 'active'): string {
    if (value === null || value === undefined) return fallback
    const raw = pyStr(value).trim().toLowerCase()
    if (!raw) return fallback
    if (!STATUS_VALUES.has(raw)) throw new ServiceError('状态仅支持 active/inactive/archived', 400)
    return raw
  }

  async getItemOr404(id: number): Promise<TreeNode> {
    const item = await this.repo.getById(id)
    if (!item) throw notFound()
    return item
  }

  toDict(item: TreeNode) {
    return treeNodeToDict(item)
  }

  /** Equivalent of _build_tree: assemble flat nodes into a nested tree; nodes whose parent isn't in the result set become roots */
  private buildTree(nodes: TreeNode[]): TreeDict[] {
    const nodeMap = new Map<number, TreeDict>()
    for (const n of nodes) nodeMap.set(n.id, { ...treeNodeToDict(n), children: [], children_count: 0 })
    const roots: TreeDict[] = []
    for (const node of nodes) {
      const d = nodeMap.get(node.id)!
      const parent = node.parent_id ? nodeMap.get(node.parent_id) : undefined
      if (parent) {
        parent.children.push(d)
        parent.children_count += 1
      } else {
        roots.push(d)
      }
    }
    // sorted(roots, key=lambda x: (x.get('sort_order') or 0, x.get('id') or 0)), stable sort
    return roots.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || (a.id || 0) - (b.id || 0))
  }

  async getTree(filters: TreeListFilters) {
    return this.buildTree(await this.repo.listForTree(filters))
  }

  async listItems(page: number, perPage: number, filters: TreeListFilters, parentId: 'root' | number | null) {
    const { total, items } = await this.repo.listPage(page, perPage, filters, parentId)
    return { items: items.map(treeNodeToDict), total, page, per_page: perPage }
  }

  async createItem(data: Data): Promise<[ReturnType<typeof treeNodeToDict>, number]> {
    const name = pyStrOrEmpty(data.name)
    const nodeCode = pyStrOrEmpty(data.node_code)
    if (!name) throw new ServiceError('节点名称不能为空', 400)
    if (!nodeCode) throw new ServiceError('节点编码不能为空', 400)
    if (await this.repo.getByCode(nodeCode)) throw new ServiceError('节点编码已存在', 400)

    let parentId: number | null = null
    if (data.parent_id !== null && data.parent_id !== undefined) parentId = tryInt(data.parent_id)
    // A falsy parent_id (including 0) skips validation and is written as-is (0 violates the FK → DB error → 500)
    if (parentId && !(await this.repo.exists(parentId))) throw new ServiceError('父节点不存在', 400)

    const status = TreeListPageService.normalizeStatus(data.status, 'active')
    const item = await this.repo.insert({
      name,
      node_code: nodeCode,
      parent_id: parentId,
      node_type: nodeTypeOf(data.node_type),
      icon: strOrNone(data.icon),
      description: strOrNone(data.description),
      sort_order: parseInt(data.sort_order, 0),
      is_active: parseBool(data.is_active, true),
      status,
      owner: strOrNone(data.owner),
    })
    return [treeNodeToDict(item), 201]
  }

  async updateItem(item: TreeNode, data: Data) {
    if (has(data, 'name') && !pyStrOrEmpty(data.name)) throw new ServiceError('节点名称不能为空', 400)
    if (has(data, 'node_code')) {
      // Validation only; not part of update_map (node_code is never actually modified)
      const nextCode = pyStrOrEmpty(data.node_code)
      if (!nextCode) throw new ServiceError('节点编码不能为空', 400)
      if (await this.repo.existsOtherWithCode(nextCode, item.id)) throw new ServiceError('节点编码已存在', 400)
    }

    const first: TreeNodeUpdate = {}
    if (has(data, 'name')) first.name = pyStrOrEmpty(data.name)
    if (has(data, 'icon')) first.icon = strOrNone(data.icon)
    if (has(data, 'description')) first.description = strOrNone(data.description)
    if (has(data, 'owner')) first.owner = strOrNone(data.owner)
    if (has(data, 'node_type')) first.node_type = nodeTypeOf(data.node_type)
    if (has(data, 'sort_order')) first.sort_order = parseInt(data.sort_order, item.sort_order || 0)
    if (has(data, 'is_active')) first.is_active = parseBool(data.is_active, item.is_active)

    // parent_id: None / '' / 0 (incl. False) → cleared; int() failure ignored; equal to self ignored; otherwise it must exist
    let parentAction: { kind: 'none' } | { kind: 'clear' } | { kind: 'set'; pid: number } = { kind: 'none' }
    if (has(data, 'parent_id')) {
      const pid = data.parent_id
      if (pid === null || pid === undefined || pid === '' || pid === 0 || pid === false) {
        parentAction = { kind: 'clear' }
      } else {
        const newPid = tryInt(pid)
        if (newPid !== null && newPid !== item.id) parentAction = { kind: 'set', pid: newPid }
      }
    }

    return this.db.transaction(async (tx) => {
      const repo = new TreeListPageRepository(tx)
      let current: TreeNode = item
      let pendingFirst = changedValues(current, first)

      if (parentAction.kind === 'set') {
        // Query triggers autoflush: persist the earlier field assignments to the DB first
        if (Object.keys(pendingFirst).length > 0) {
          await repo.update(item.id, pendingFirst)
          current = { ...current, ...(pendingFirst as Partial<TreeNode>) }
          pendingFirst = {}
        }
        if (!(await repo.exists(parentAction.pid))) throw new ServiceError('父节点不存在', 400)
        // Besides not being itself, the parent must not be a descendant (would form a cycle; the frontend blocks this, but direct API calls would write it to the DB)
        if (await wouldCreateCycle(tx, 'tree_nodes', item.id, parentAction.pid)) {
          throw new ServiceError('不能将节点移动到自身或其子节点下', 400)
        }
      }

      const second: TreeNodeUpdate = { ...pendingFirst }
      if (parentAction.kind === 'clear') second.parent_id = null
      if (parentAction.kind === 'set') second.parent_id = parentAction.pid
      if (has(data, 'status')) second.status = TreeListPageService.normalizeStatus(data.status, item.status || 'active')

      const changes = changedValues(current, second)
      if (Object.keys(changes).length > 0) await repo.update(item.id, changes)
      if (current === item && Object.keys(changes).length === 0) return treeNodeToDict(item)
      return treeNodeToDict((await repo.getById(item.id))!)
    })
  }

  async deleteItem(item: TreeNode) {
    await this.db.transaction((tx) => new TreeListPageRepository(tx).deleteWithChildrenDetached(item.id))
    return { message: '删除成功' }
  }

  /** For method=GET, data is the query params (first value of each key); otherwise the JSON body */
  async exportItems(data: Data, requestMethod: string) {
    let ids: unknown
    let fields: unknown[]
    let exportMode: string
    let filters: unknown
    if (requestMethod === 'GET') {
      ids = []
      const fieldsRaw = pyStrOrEmpty(data.fields)
      fields = fieldsRaw ? fieldsRaw.split(',').map((f) => f.trim()).filter(Boolean) : []
      exportMode = 'filtered'
      filters = {
        search: data.search,
        node_type: data.node_type,
        status: data.status,
        owner: data.owner,
        is_active: data.is_active,
      }
    } else {
      ids = pyTruthy(data.ids) ? data.ids : []
      fields = pyTruthy(data.fields) ? pyIterate(data.fields) : []
      exportMode = pyTruthy(data.export_mode) ? pyStr(data.export_mode).trim() : 'selected'
      filters = pyTruthy(data.filters) ? data.filters : {}
    }
    const fileType = normalizeTableFileType(data.file_type)

    let validFields = fields.filter(isExportField)
    if (validFields.length === 0) validFields = Object.keys(EXPORT_FIELD_MAP)

    let items: TreeNode[]
    if (exportMode === 'filtered') {
      // Return 500 when filters is not an object (e.g. list/str)
      if (!isPlainObject(filters)) throw new ServiceError("'filters' object has no attribute 'get'", 500)
      items = await this.repo.listAllOrdered({
        search: pyStrOrEmpty(filters.search),
        nodeType: pyStrOrEmpty(filters.node_type),
        status: pyStrOrEmpty(filters.status),
        owner: pyStrOrEmpty(filters.owner),
        isActive: parseBool(filters.is_active, null),
      })
    } else {
      if (!Array.isArray(ids) || ids.length === 0) throw new ServiceError('请先勾选要导出的数据', 400)
      items = await this.repo.listByIdsOrdered(resolveIdList(ids))
    }

    const headers = validFields.map((f) => EXPORT_FIELD_MAP[f]![0])
    const rows = items.map((item) => validFields.map((f) => EXPORT_FIELD_MAP[f]![1](item)))
    return buildTable(headers, rows, 'tree_list_page_export', fileType)
  }

  async downloadTemplate(fileTypeRaw: unknown) {
    return buildTable(TEMPLATE_HEADERS, TEMPLATE_ROWS, 'tree_list_page_import_template', normalizeTableFileType(fileTypeRaw))
  }

  async importItems(file: UploadedFile | null) {
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
    const mappedFields = new Set(headerMap.values())
    if (!mappedFields.has('name') || !mappedFields.has('node_code')) {
      throw new ServiceError('导入文件缺少"节点名称/节点编码"列', 400)
    }

    return this.db.transaction(async (tx) => {
      const repo = new TreeListPageRepository(tx)
      let created = 0
      let updated = 0
      const errors: ErrorRow[] = []
      // Previous row's write not yet flushed (the pending/dirty objects in the Session)
      let pending: (() => Promise<unknown>) | null = null
      // Rows with a parent; cycle check runs for all of them once every row is written
      const withParent: Array<{ line: number; row: Record<string, string>; nodeCode: string; parentId: number }> = []
      const flush = async () => {
        if (!pending) return
        const op = pending
        pending = null
        await op()
      }

      for (const [line, row] of table.rows) {
        const mapped: Record<string, string> = {}
        for (const [key, value] of Object.entries(row)) {
          const field = headerMap.get(key)
          if (field) mapped[field] = value
        }

        const name = pyStrOrEmpty(mapped.name)
        const nodeCode = pyStrOrEmpty(mapped.node_code)
        if (!name || !nodeCode) {
          errors.push(buildErrorRow(line, '节点名称和编码不能为空', row))
          continue
        }

        // `if parent_id_raw:` (string truthiness, so '0' counts) → int(), None on failure; existence isn't checked (the FK is the fallback)
        const parentId = mapped.parent_id ? tryInt(mapped.parent_id) : null
        const nodeType = nodeTypeOf(mapped.node_type)
        const status = TreeListPageService.normalizeStatus(mapped.status, 'active')
        const values = {
          name,
          parent_id: parentId,
          node_type: nodeType,
          icon: strOrNone(mapped.icon),
          status,
          owner: strOrNone(mapped.owner),
          sort_order: parseInt(mapped.sort_order, 0),
          is_active: parseBool(mapped.is_active, true),
          description: strOrNone(mapped.description),
        }

        if (parentId !== null) withParent.push({ line, row, nodeCode, parentId })

        await flush() // Query triggers autoflush
        const existing = await repo.getByCode(nodeCode)
        if (existing) {
          const changes = changedValues(existing, values)
          if (Object.keys(changes).length > 0) pending = () => repo.update(existing.id, changes)
          updated += 1
        } else {
          pending = () => repo.insert({ ...values, node_code: nodeCode })
          created += 1
        }
      }

      await flush()
      // An imported parent_id can make a node its own ancestor (including pointing at itself); cyclic rows are recorded as errors and the whole batch rolls back
      if (errors.length === 0) {
        for (const item of withParent) {
          const node = await repo.getByCode(item.nodeCode)
          if (node && (await wouldCreateCycle(tx, 'tree_nodes', node.id, item.parentId))) {
            errors.push(buildErrorRow(item.line, `父节点 ${item.parentId} 会导致成环（不能是自身或其子节点）`, item.row))
          }
        }
      }

      if (errors.length > 0) {
        throw new ServiceError('导入失败，存在错误数据', 400, {
          error_rows: errors.slice(0, 500),
          error_count: errors.length,
        })
      }
      return { message: '导入成功', created, updated }
    })
  }
}
