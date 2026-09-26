/**
 * Bad input is the caller's error: 400 with a readable message, never a 500. Covers the global mapping of database
 * input errors (common/db-errors.ts via the error handler), request bodies declared with common/validation.ts,
 * invalidInput() for values of the wrong type or shape, and the per-module rules added alongside.
 */

import type { FastifyInstance } from 'fastify'
import { like } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DbHandle } from '@/db/client'
import { announcements, dict_types, menus, notifications, roles } from '@/db/schema'
import { buildTestApp, FIXTURE_PREFIX, openTestDb, superAdminSession, type AuthedSession } from './helpers'

const P = `${FIXTURE_PREFIX}iv_`
const CC = '/api/admin/component-center'
let app: FastifyInstance
let handle: DbHandle
let s: AuthedSession

beforeAll(async () => {
  handle = openTestDb()
  app = await buildTestApp()
  s = await superAdminSession(app, handle)
})

afterAll(async () => {
  await handle.db.delete(roles).where(like(roles.code, `${P}%`))
  await handle.db.delete(menus).where(like(menus.code, `${P}%`))
  await handle.db.delete(dict_types).where(like(dict_types.code, `${P}%`))
  await handle.db.delete(announcements).where(like(announcements.title, `${P}%`))
  await handle.db.delete(notifications).where(like(notifications.title, `${P}%`))
  await app.close()
  await handle.pool.end()
})

const send = async (method: string, url: string, payload?: unknown) => {
  const res = await s.inject({ method: method as 'POST', url, ...(payload !== undefined ? { payload: payload as object } : {}) })
  return [res.statusCode, res.json()] as const
}
const bad = (error: string) => [400, { error }] as const

describe('bad input → 400', () => {
  it('values of the wrong type or shape: 「请求参数格式不正确」', async () => {
    const cases: Array<[string, string, unknown]> = [
      ['POST', '/api/admin/announcements', { title: `${P}a`, content: 'c', sort_order: 'abc' }],
      ['POST', '/api/admin/menus', { name: 'x', code: 5 }],
      ['PUT', `${CC}/advanced-table/rows/reorder`, [5]],
      ['PUT', `${CC}/kanban/cards/reorder`, [5]],
      ['POST', `${CC}/advanced-table/rows/batch-delete`, { ids: [true] }],
      ['POST', `${CC}/ai/prompt/templates`, { name: 5, content: 'x' }],
      ['POST', `${CC}/ai/prompt/preview`, { content: 5 }],
      ['POST', `${CC}/ai/sql/generate`, { question: 5 }],
      ['POST', `${CC}/ai/sql/execute`, { sql: 5 }],
      ['POST', `${CC}/list-page/export`, { export_mode: 'filtered', filters: 'x' }],
      ['POST', `${CC}/card-list-page/export`, { export_mode: 'filtered', filters: 'x' }],
      ['POST', `${CC}/stats-list-page/export`, { export_mode: 'selected', ids: ['a'] }],
    ]
    for (const [method, url, payload] of cases) {
      expect(await send(method, url, payload), `${method} ${url} ${JSON.stringify(payload)}`).toEqual(bad('请求参数格式不正确'))
    }
  })

  it('modules declaring their body with common/validation.ts: 「<field>的值无效」', async () => {
    expect(await send('POST', '/api/admin/dicts', { name: 'x', code: `${P}d1`, is_active: 'abc' })).toEqual(bad('是否启用的值无效'))
    expect(await send('POST', '/api/admin/dicts', { name: 'x', code: `${P}d2`, sort_order: 'abc' })).toEqual(bad('排序的值无效'))
    expect(await send('POST', '/api/admin/dicts', [1])).toEqual(bad('请求参数格式不正确'))
  })

  it('the database rejecting a value: a readable message instead of a 500', async () => {
    expect(await send('POST', '/api/admin/dicts', { name: 'x', code: 'x'.repeat(300) })).toEqual(bad('字段长度超出限制'))
    expect(await send('POST', '/api/admin/announcements', { title: `${P}${'x'.repeat(300)}`, content: 'c' })).toEqual(bad('字段长度超出限制'))
    expect(await send('POST', '/api/admin/menus', { name: 'x', code: `${P}m1`, parent_id: 99999999 })).toEqual(bad('关联的数据不存在或仍被引用'))
    expect(await send('POST', `${CC}/detail-tabs/members`, { name: 'x'.repeat(300) })).toEqual(bad('字段长度超出限制'))
  })

  it('module rules: roles, users, announcements, menus, notifications, Gantt tasks', async () => {
    const [, existing] = await send('GET', '/api/admin/roles')
    const [created, role] = await send('POST', '/api/admin/roles', { name: 'x', code: `${P}r1` })
    expect(created).toBe(201)
    expect(await send('PUT', `/api/admin/roles/${role.id}`, { code: (existing as Array<{ code: string }>)[0]!.code })).toEqual(bad('角色编码已存在'))
    expect(await send('PUT', `/api/admin/roles/${role.id}`, { name: '' })).toEqual(bad('角色名称不能为空'))
    expect(await send('PUT', `/api/admin/roles/${role.id}`, { name: null })).toEqual(bad('角色名称不能为空'))
    expect(await send('PUT', `/api/admin/roles/${role.id}`, { code: 5 })).toEqual(bad('请求参数格式不正确'))

    expect(await send('POST', '/api/admin/users', { username: `${P}u`, password: 'abcdef1', role_ids: 'x' })).toEqual(bad('role_ids 必须是数组'))

    expect(await send('POST', '/api/admin/announcements', { title: `${P}a`, content: 'c', announce_type: 'zzz' })).toEqual(
      bad('公告类型只能是 system、activity 或 update'),
    )
    expect(await send('POST', '/api/admin/announcements', { title: `${P}a`, content: 'c', status: 'zzz' })).toEqual(bad('状态只能是 draft 或 published'))

    expect(await send('POST', '/api/admin/menus', { name: 'x', code: `${P}m2`, menu_type: 'zzz' })).toEqual(bad('菜单类型只能是 directory、menu 或 button'))

    expect(await send('POST', '/api/admin/notifications', { title: `${P}n`, is_global: false })).toEqual(bad('请选择接收通知的用户'))
    expect(await send('POST', '/api/admin/notifications', { title: `${P}n`, is_global: false, user_id: 99999999 })).toEqual(bad('接收通知的用户不存在'))

    expect(await send('POST', `${CC}/gantt/tasks`, { title: 'x', start_date: '2026-02-01', end_date: '2026-01-01' })).toEqual(bad('开始日期不能晚于结束日期'))
    const [, task] = await send('POST', `${CC}/gantt/tasks`, { title: 'x', start_date: '2026-01-01', end_date: '2026-01-05' })
    expect(await send('PUT', `${CC}/gantt/tasks/${task.id}`, { start_date: null })).toEqual(bad('开始日期不能为空'))
    expect(await send('PUT', `${CC}/gantt/tasks/${task.id}`, { end_date: '2025-12-31' })).toEqual(bad('开始日期不能晚于结束日期'))
    await send('DELETE', `${CC}/gantt/tasks/${task.id}`)
  })
})
