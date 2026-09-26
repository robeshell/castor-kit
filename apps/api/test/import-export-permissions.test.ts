/**
 * Import / export button permissions across modules (AGENTS.md "导入导出规范"):
 * export needs `<perm>_export`; the import template and import need `<perm>_import`.
 * The view permission and `_add` / `_edit` / `_delete` grant none of them.
 */

import { like } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DbHandle } from '@/db/client'
import { dict_types } from '@/db/schema'
import { buildTestApp, cleanupFixture, openTestDb, scopedSession, type AuthedSession } from './helpers'

const P = 'ck_test_ie_perm_'
const CC = '/api/admin/component-center'

interface Case {
  name: string
  /** Menu (view) permission code; buttons are `${perm}_add` / `_edit` / `_delete` / `_export` / `_import` */
  perm: string
  /** Export routes: [method, path] */
  exports: ['GET' | 'POST', string][]
  template: string
  import: string
}

let app: FastifyInstance
let handle: DbHandle
let cases: Case[]
/** view + add / edit / delete of every module, but no export / import */
let editor: AuthedSession
/** view + export */
let exporter: AuthedSession
/** view + import */
let importer: AuthedSession

const standard = (name: string, perm: string, base: string, exportMethods: ('GET' | 'POST')[] = ['POST']): Case => ({
  name,
  perm,
  exports: exportMethods.map((m) => [m, `${base}/export`]),
  template: `${base}/template`,
  import: `${base}/import`,
})

beforeAll(async () => {
  handle = openTestDb()
  app = await buildTestApp()
  await cleanupFixture(handle)
  await handle.db.delete(dict_types).where(like(dict_types.code, `${P}%`))
  const [dict] = await handle.db.insert(dict_types).values({ name: '导入导出权限', code: `${P}dict` }).returning()
  const dictBase = `/api/admin/dicts/${dict!.id}/items`

  cases = [
    standard('users', 'system_users', '/api/admin/users'),
    standard('roles', 'system_roles', '/api/admin/roles'),
    standard('menus', 'system_menus', '/api/admin/menus'),
    standard('announcements', 'system_announcements', '/api/admin/announcements'),
    { name: 'dicts', perm: 'system_dicts', exports: [['GET', `${dictBase}/export`]], template: `${dictBase}/template`, import: `${dictBase}/import` },
    standard('list-page', 'system_list_page', `${CC}/list-page`, ['GET', 'POST']),
    standard('stats-list-page', 'system_stats_list_page', `${CC}/stats-list-page`, ['GET', 'POST']),
    standard('tree-list-page', 'system_tree_list_page', `${CC}/tree-list-page`, ['GET', 'POST']),
    standard('card-list-page', 'system_card_list_page', `${CC}/card-list-page`, ['GET', 'POST']),
    standard('dynamic-form-page', 'system_dynamic_form_page', `${CC}/dynamic-form-page`, ['GET', 'POST']),
  ]
  const codes = (suffixes: string[]) => cases.flatMap((c) => [c.perm, ...suffixes.map((s) => `${c.perm}_${s}`)])
  editor = await scopedSession(app, handle, { name: 'ie_editor', codes: codes(['add', 'edit', 'delete']), dataScope: 'all' })
  exporter = await scopedSession(app, handle, { name: 'ie_exporter', codes: codes(['export']), dataScope: 'all' })
  importer = await scopedSession(app, handle, { name: 'ie_importer', codes: codes(['import']), dataScope: 'all' })
})

afterAll(async () => {
  await cleanupFixture(handle)
  await handle.db.delete(dict_types).where(like(dict_types.code, `${P}%`))
  await app.close()
  await handle.pool.end()
})

const send = (session: AuthedSession, method: 'GET' | 'POST', url: string) =>
  session.inject({ method, url, ...(method === 'POST' ? { payload: {} } : {}) })

function expectForbidden(res: Awaited<ReturnType<typeof send>>, label: string) {
  expect(res.statusCode, `${label}: ${res.body}`).toBe(403)
  expect(res.json().error, label).toMatch(/^无权限/)
}

describe('import / export button permissions', () => {
  it('view + add / edit / delete: export, template and import are all 403', async () => {
    for (const c of cases) {
      for (const [method, url] of c.exports) expectForbidden(await send(editor, method, url), `${c.name} ${method} export`)
      expectForbidden(await send(editor, 'GET', c.template), `${c.name} template`)
      expectForbidden(await send(editor, 'POST', c.import), `${c.name} import`)
    }
  })

  it('_export allows export only; template and import stay 403', async () => {
    for (const c of cases) {
      for (const [method, url] of c.exports) {
        // Past the gate: 200, or 400 when a selected-mode export has no ids
        const res = await send(exporter, method, url)
        expect([200, 400], `${c.name} ${method} export: ${res.body}`).toContain(res.statusCode)
      }
      expectForbidden(await send(exporter, 'GET', c.template), `${c.name} template`)
      expectForbidden(await send(exporter, 'POST', c.import), `${c.name} import`)
    }
  })

  it('_import allows the template and import; export stays 403', async () => {
    for (const c of cases) {
      const template = await send(importer, 'GET', c.template)
      expect(template.statusCode, `${c.name} template: ${template.body}`).toBe(200)
      // Past the gate: no file uploaded
      const imported = await send(importer, 'POST', c.import)
      expect([imported.statusCode, imported.json()], `${c.name} import`).toEqual([400, { error: '请上传导入文件' }])
      for (const [method, url] of c.exports) expectForbidden(await send(importer, method, url), `${c.name} ${method} export`)
    }
  })
})
