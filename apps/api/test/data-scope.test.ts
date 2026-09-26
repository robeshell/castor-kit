import { PgDialect } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import { computeDataScope, dataScopeWhere, scopeCoversDept, type DataScope } from '@/common/data-scope'
import { admin_users, type AdminUserWithRoles } from '@/db/schema'

const dialect = new PgDialect()
const render = (scope: DataScope) => {
  const where = dataScopeWhere(scope, { deptColumn: admin_users.dept_id, ownerColumn: admin_users.id })
  return where ? dialect.sqlToQuery(where) : undefined
}

function user(deptId: number | null, roles: [code: string, scope: string][]): AdminUserWithRoles {
  return {
    id: 7,
    username: 'u',
    dept_id: deptId,
    roles: roles.map(([code, data_scope], i) => ({ id: 100 + i, code, data_scope, name: code, menus: [] })),
  } as unknown as AdminUserWithRoles
}

const lookups = {
  customDeptIds: async (roleIds: number[]) => roleIds.flatMap((id) => [id * 10]),
  subtree: async (deptIds: number[]) => deptIds.flatMap((id) => [id, id + 1, id + 2]),
}

describe('computeDataScope', () => {
  it('super_admin 或任一角色为 all → 不限制', async () => {
    expect(await computeDataScope(user(1, [['super_admin', 'self']]), lookups)).toEqual({ all: true })
    expect(await computeDataScope(user(1, [['a', 'self'], ['b', 'all']]), lookups)).toEqual({ all: true })
  })

  it('各角色范围取并集：本部门及下级 + 自定义 + 本人', async () => {
    const scope = await computeDataScope(user(1, [['a', 'dept_and_children'], ['b', 'custom'], ['c', 'self']]), lookups)
    expect(scope).toEqual({ all: false, deptIds: [1, 2, 3, 1010], userId: 7, self: true })
  })

  it('dept 只含本部门；没有部门时 dept / dept_and_children 什么也不给', async () => {
    expect(await computeDataScope(user(5, [['a', 'dept']]), lookups)).toMatchObject({ deptIds: [5], self: false })
    expect(await computeDataScope(user(null, [['a', 'dept_and_children']]), lookups)).toMatchObject({ deptIds: [], self: false })
  })

  it('没有角色、未知取值 → 空范围（失败即关闭）', async () => {
    expect(await computeDataScope(user(1, []), lookups)).toMatchObject({ all: false, deptIds: [], self: false })
    expect(await computeDataScope(user(1, [['a', 'bogus']]), lookups)).toMatchObject({ all: false, deptIds: [], self: false })
  })
})

describe('dataScopeWhere', () => {
  it('不限制 → undefined（不加条件）', () => {
    expect(render({ all: true })).toBeUndefined()
  })

  it('受限但为空 → 恒假条件，绝不退化成不过滤', () => {
    expect(render({ all: false, deptIds: [], userId: 7, self: false })?.sql).toBe('false')
  })

  it('部门 + 本人 → OR 条件', () => {
    const q = render({ all: false, deptIds: [1, 2], userId: 7, self: true })!
    expect(q.sql).toBe('("admin_users"."dept_id" in ($1, $2) or "admin_users"."id" = $3)')
    expect(q.params).toEqual([1, 2, 7])
  })

  it('只有本人 / 只有部门', () => {
    expect(render({ all: false, deptIds: [], userId: 7, self: true })!.sql).toBe('"admin_users"."id" = $1')
    expect(render({ all: false, deptIds: [3], userId: 7, self: false })!.sql).toBe('"admin_users"."dept_id" in ($1)')
  })

  it('表没有部门列时，只看本人', () => {
    const where = dataScopeWhere({ all: false, deptIds: [3], userId: 7, self: false }, { ownerColumn: admin_users.id })
    expect(dialect.sqlToQuery(where!).sql).toBe('false')
  })

  it('scopeCoversDept', () => {
    expect(scopeCoversDept({ all: true }, null)).toBe(true)
    expect(scopeCoversDept({ all: false, deptIds: [3], userId: 7, self: true }, 3)).toBe(true)
    expect(scopeCoversDept({ all: false, deptIds: [3], userId: 7, self: true }, 4)).toBe(false)
    expect(scopeCoversDept({ all: false, deptIds: [3], userId: 7, self: true }, null)).toBe(false)
  })
})
