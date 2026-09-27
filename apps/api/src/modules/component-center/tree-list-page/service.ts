/**
 * Tree list page service layer
 *
 * - Updates write only the columns that change; with no change no UPDATE is sent and updated_at stays
 * - A node can't move under itself or its descendants (the tree would form a cycle)
 * - On delete, children have their parent_id cleared first (see repository.deleteWithChildrenDetached)
 */

import type { z } from 'zod'
import { writeError } from '@/common/db-errors'
import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { buildTable, normalizeTableFileType, readTableFile, TableFileError, type UploadedFile } from '@/common/tabular'
import { wouldCreateCycle } from '@/common/tree'
import { changedFields, exportColumns, parseIntText, parseYesNo } from '@/common/validation'
import type { Db, Executor } from '@/db/client'
import { treeNodeToDict, type TreeNode } from '@/db/schema'
import { TreeListPageRepository, type TreeListFilters, type TreeNodeUpdate } from './repository'
import {
  buildErrorRow,
  EXPORT_FIELD_MAP,
  IMPORT_HEADER_MAP,
  STATUS_ERROR,
  TEMPLATE_HEADERS,
  TEMPLATE_ROWS,
  TREE_STATUSES,
  type ErrorRow,
  type treeExportBody,
  type TreeNodeInput,
} from './schema'

type TreeDict = ReturnType<typeof treeNodeToDict> & { children: TreeDict[]; children_count: number }

/** An import cell: trimmed, blank → null */
const cell = (value: string | undefined) => (value ?? '').trim() || null

/** Column values from parsed input: a blank node type is 'category' */
function columns<T extends Partial<TreeNodeInput>>(values: T): T {
  return values.node_type === null ? { ...values, node_type: 'category' } : values
}

export class TreeListPageService {
  private readonly repo: TreeListPageRepository

  constructor(private readonly db: Db) {
    this.repo = new TreeListPageRepository(db)
  }

  async getItemOr404(id: number): Promise<TreeNode> {
    const item = await this.repo.getById(id)
    if (!item) throw notFound()
    return item
  }

  toDict(item: TreeNode) {
    return treeNodeToDict(item)
  }

  /** Assemble flat nodes into a nested tree; nodes whose parent isn't in the result set become roots */
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
    // Roots by (sort_order, id)
    return roots.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || (a.id || 0) - (b.id || 0))
  }

  async getTree(filters: TreeListFilters) {
    return this.buildTree(await this.repo.listForTree(filters))
  }

  async listItems(page: number, perPage: number, filters: TreeListFilters, parentId: 'root' | number | null) {
    const { total, items } = await this.repo.listPage(page, perPage, filters, parentId)
    return { items: items.map(treeNodeToDict), total, page, per_page: perPage }
  }

  async createItem(values: TreeNodeInput): Promise<[ReturnType<typeof treeNodeToDict>, number]> {
    if (await this.repo.getByCode(values.node_code)) throw new ServiceError('节点编码已存在', 400)
    if (values.parent_id !== null && !(await this.repo.exists(values.parent_id))) throw new ServiceError('父节点不存在', 400)
    const item = await this.repo.insert(columns(values))
    return [treeNodeToDict(item), 201]
  }

  async updateItem(item: TreeNode, values: Partial<TreeNodeInput>) {
    if (values.node_code !== undefined && (await this.repo.existsOtherWithCode(values.node_code, item.id))) {
      throw new ServiceError('节点编码已存在', 400)
    }
    return this.inTx(async (repo, tx) => {
      const parentId = values.parent_id
      if (parentId !== undefined && parentId !== null && parentId !== item.parent_id) {
        if (!(await repo.exists(parentId))) throw new ServiceError('父节点不存在', 400)
        // Not itself nor a descendant: the frontend blocks this, but a direct API call would store a cycle
        if (await wouldCreateCycle(tx, 'tree_nodes', item.id, parentId)) {
          throw new ServiceError('不能将节点移动到自身或其子节点下', 400)
        }
      }
      const changes: TreeNodeUpdate = changedFields(item, columns(values))
      if (Object.keys(changes).length === 0) return treeNodeToDict(item)
      await repo.update(item.id, changes)
      return treeNodeToDict((await repo.getById(item.id))!)
    })
  }

  private async inTx<T>(fn: (repo: TreeListPageRepository, tx: Executor) => Promise<T>): Promise<T> {
    try {
      return await this.db.transaction((tx) => fn(new TreeListPageRepository(tx), tx))
    } catch (err) {
      throw writeError(err)
    }
  }

  async deleteItem(item: TreeNode) {
    await this.db.transaction((tx) => new TreeListPageRepository(tx).deleteWithChildrenDetached(item.id))
    return { message: '删除成功' }
  }

  async exportItems(options: z.output<typeof treeExportBody>) {
    const validFields = exportColumns(options.fields, EXPORT_FIELD_MAP)

    let items: TreeNode[]
    if (options.export_mode !== 'selected') {
      const { search, node_type: nodeType, status, owner, is_active: isActive } = options.filters
      items = await this.repo.listAllOrdered({
        search: search ?? '',
        nodeType: nodeType ?? '',
        status: status ?? '',
        owner: owner ?? '',
        isActive: parseYesNo(isActive),
      })
    } else {
      if (options.ids.length === 0) throw new ServiceError('请先勾选要导出的数据', 400)
      items = await this.repo.listByIdsOrdered(options.ids)
    }

    const headers = validFields.map((f) => EXPORT_FIELD_MAP[f]![0])
    const rows = items.map((item) => validFields.map((f) => EXPORT_FIELD_MAP[f]![1](item)))
    return buildTable(headers, rows, 'tree_list_page_export', normalizeTableFileType(options.file_type))
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

    return this.inTx(async (repo, tx) => {
      let created = 0
      let updated = 0
      const errors: ErrorRow[] = []
      // Rows with a parent; the cycle check runs once every row is written
      const withParent: Array<{ line: number; row: Record<string, string>; nodeCode: string; parentId: number }> = []

      for (const [line, row] of table.rows) {
        const mapped: Record<string, string> = {}
        for (const [key, value] of Object.entries(row)) {
          const field = headerMap.get(key)
          if (field) mapped[field] = value
        }

        const name = cell(mapped.name)
        const nodeCode = cell(mapped.node_code)
        if (!name || !nodeCode) {
          errors.push(buildErrorRow(line, '节点名称和编码不能为空', row))
          continue
        }
        const status = (cell(mapped.status) ?? 'active').toLowerCase()
        if (!(TREE_STATUSES as readonly string[]).includes(status)) {
          errors.push(buildErrorRow(line, STATUS_ERROR, row))
          continue
        }
        const parentText = cell(mapped.parent_id)
        const parentId = parentText === null ? null : parseIntText(parentText, 0)
        if (parentId !== null && (parentId <= 0 || !(await repo.exists(parentId)))) {
          errors.push(buildErrorRow(line, '父节点不存在', row))
          continue
        }
        // Rows with errors are only collected: the transaction is rolled back below, so nothing written stays
        if (errors.length > 0) continue

        const values = {
          name,
          parent_id: parentId,
          node_type: cell(mapped.node_type) ?? 'category',
          icon: cell(mapped.icon),
          status,
          owner: cell(mapped.owner),
          sort_order: parseIntText(mapped.sort_order, 0),
          is_active: parseYesNo(mapped.is_active, true)!,
          description: cell(mapped.description),
        }
        if (parentId !== null) withParent.push({ line, row, nodeCode, parentId })

        const existing = await repo.getByCode(nodeCode)
        if (existing) {
          const changes = changedFields(existing, values)
          if (Object.keys(changes).length > 0) await repo.update(existing.id, changes)
          updated += 1
        } else {
          await repo.insert({ ...values, node_code: nodeCode })
          created += 1
        }
      }

      // An imported parent can make a node its own ancestor (including pointing at itself): those rows are errors
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
