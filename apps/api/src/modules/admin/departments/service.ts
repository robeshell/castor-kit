/**
 * Departments module service layer
 *
 * Departments themselves are not data-scoped: anyone who may open the departments, users or roles page sees the whole
 * tree (it's the vocabulary those pages pick from).
 */

import type { EventBus } from '@/common/webhooks'
import { writeError } from '@/common/db-errors'
import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { changedFields } from '@/common/validation'
import type { Db } from '@/db/client'
import { departmentToDict, type Department } from '@/db/schema'
import { DepartmentRepository, type DepartmentValues } from './repository'
import type { DepartmentInput } from './schema'

export type DepartmentNode = ReturnType<typeof departmentToDict> & {
  leader_name: string | null
  user_count: number
  children: DepartmentNode[]
}

export class DepartmentService {
  private readonly repo: DepartmentRepository

  constructor(
    private readonly db: Db,
    /** Webhook events (department.created / updated / deleted), emitted after the write committed */
    private readonly events?: Pick<EventBus, 'emit'>,
  ) {
    this.repo = new DepartmentRepository(db)
  }

  private async inTx<T>(fn: (repo: DepartmentRepository) => Promise<T>): Promise<T> {
    try {
      return await this.db.transaction((tx) => fn(new DepartmentRepository(tx)))
    } catch (err) {
      throw writeError(err)
    }
  }

  /**
   * Department tree. With `search`, keeps matching departments (name or code), their ancestors and their whole subtrees;
   * with `status`, keeps only departments in that status (and their ancestors, so the tree stays connected).
   */
  async listTree(search: string, status: string): Promise<DepartmentNode[]> {
    const all = await this.repo.listAll()
    const counts = await this.repo.userCountsByDept()
    const leaderIds = [...new Set(all.map((d) => d.leader_id).filter((id): id is number => id !== null))]
    const names = await this.repo.userNames(leaderIds)

    const nodes = new Map<number, DepartmentNode>(
      all.map((d) => [
        d.id,
        {
          ...departmentToDict(d),
          leader_name: d.leader_id !== null ? (names.get(d.leader_id) ?? null) : null,
          user_count: counts.get(d.id) ?? 0,
          children: [],
        },
      ]),
    )
    const roots: DepartmentNode[] = []
    for (const d of all) {
      const node = nodes.get(d.id)!
      const parent = d.parent_id !== null ? nodes.get(d.parent_id) : undefined
      if (parent) parent.children.push(node)
      else roots.push(node)
    }

    const keyword = search.toLowerCase()
    const matches = (n: DepartmentNode) =>
      (!keyword || n.name.toLowerCase().includes(keyword) || n.code.toLowerCase().includes(keyword)) &&
      (!status || n.status === status)
    if (!keyword && !status) return roots

    // Keep a node if it matches (then with its matching subtree when searching) or any descendant is kept
    const prune = (list: DepartmentNode[], parentMatched: boolean): DepartmentNode[] =>
      list.flatMap((n) => {
        const self = matches(n)
        const inherited = parentMatched && Boolean(keyword) && (!status || n.status === status)
        const children = prune(n.children, self || inherited)
        return self || inherited || children.length > 0 ? [{ ...n, children }] : []
      })
    return prune(roots, false)
  }

  async getOr404(id: number): Promise<Department> {
    const dept = await this.repo.getById(id)
    if (!dept) throw notFound()
    return dept
  }

  getItem(dept: Department) {
    return departmentToDict(dept)
  }

  /** The checks that need the database, for the fields present in values (the body is already parsed) */
  private async checkReferences(values: Partial<DepartmentInput>, existing: Department | null): Promise<void> {
    if (values.code !== undefined && (await this.repo.getByCode(values.code, existing?.id))) {
      throw new ServiceError('部门编码已存在', 400)
    }
    if (values.parent_id !== undefined && values.parent_id !== null) {
      if (!(await this.repo.getById(values.parent_id))) throw new ServiceError('上级部门不存在', 400)
      if (existing && (await this.repo.wouldCreateCycle(existing.id, values.parent_id))) {
        throw new ServiceError('上级部门不能是自身或其下级部门', 400)
      }
    }
    if (values.leader_id !== undefined && values.leader_id !== null && (await this.repo.userNames([values.leader_id])).size === 0) {
      throw new ServiceError('负责人不存在', 400)
    }
  }

  async createItem(values: DepartmentInput) {
    await this.checkReferences(values, null)
    const created = await this.inTx((repo) => repo.insert(values))
    const dict = departmentToDict(created)
    await this.events?.emit('department.created', dict)
    return dict
  }

  async updateItem(dept: Department, values: Partial<DepartmentInput>) {
    await this.checkReferences(values, dept)
    const changes: DepartmentValues = changedFields(dept, values)
    await this.inTx((repo) => repo.update(dept.id, changes))
    const dict = departmentToDict((await this.repo.getById(dept.id))!)
    await this.events?.emit('department.updated', dict)
    return dict
  }

  async deleteItem(dept: Department) {
    if ((await this.repo.countChildren(dept.id)) > 0) throw new ServiceError('存在下级部门，不能删除', 400)
    if ((await this.repo.countUsers(dept.id)) > 0) throw new ServiceError('部门下还有用户，不能删除', 400)
    await this.inTx((repo) => repo.delete(dept.id))
    await this.events?.emit('department.deleted', { id: dept.id, code: dept.code })
    return { message: '删除成功' }
  }

  /** Move a department one place up or down among its siblings (renumbers sort_order in steps of 10) */
  async sortItem(dept: Department, direction: 'up' | 'down') {
    const siblings = await this.repo.listSiblings(dept.parent_id)
    const ids = siblings.map((d) => d.id)
    const idx = ids.indexOf(dept.id)
    const target = direction === 'up' ? idx - 1 : idx + 1
    if (idx === -1 || target < 0 || target >= ids.length) return { message: '已在当前层级的边界，无需移动', changed: false }
    ;[ids[idx], ids[target]] = [ids[target]!, ids[idx]!]

    const byId = new Map(siblings.map((d) => [d.id, d]))
    await this.inTx(async (repo) => {
      for (const [i, id] of ids.entries()) {
        const order = (i + 1) * 10
        if (byId.get(id)!.sort_order !== order) await repo.update(id, { sort_order: order })
      }
    })
    return { message: '排序成功', changed: true }
  }
}
