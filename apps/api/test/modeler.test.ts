/**
 * Visual modeler routes: only in development, only super admins, no API tokens; spec validation; job polling;
 * one job at a time. Generation itself (the detached runner) is exercised by hand — it writes into the repository.
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DbHandle } from '@/db/client'
import { sessions, system_settings } from '@/db/schema'
import { writeLock, writeState, releaseLock, type JobState } from '@/modules/admin/modeler/files'
import { startFakeUpstream } from './cc-ai-fake-upstream'
import { buildTestApp, cleanupFixture, createFixture, openTestDb, scopedSession, superAdminSession, type AuthedSession } from './helpers'

const BASE = '/api/admin/modeler'
let app: FastifyInstance
let handle: DbHandle
let admin: AuthedSession
let dir: string

const spec = {
  name: 'ck_modeler_probe',
  title: '探针',
  fields: [{ name: 'name', type: 'str', label: '名称', required: true }],
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'ck-modeler-'))
  process.env.MODELER_DIR = dir
  handle = openTestDb()
  app = await buildTestApp({ modelerEnabled: true })
  await createFixture(handle)
  admin = await superAdminSession(app, handle)
})

afterAll(async () => {
  delete process.env.MODELER_DIR
  rmSync(dir, { recursive: true, force: true })
  await handle.db.delete(system_settings)
  await cleanupFixture(handle)
  await app.close()
  await handle.pool.end()
})

describe('modeler', () => {
  it('不是开发环境时不注册路由', async () => {
    const other = await buildTestApp()
    try {
      const s = await superAdminSession(other, handle)
      expect((await s.inject({ url: `${BASE}/meta` })).statusCode).toBe(404)
    } finally {
      await other.close()
    }
    admin = await superAdminSession(app, handle)
  })

  it('只有超级管理员能用；API Token 一律拒绝', async () => {
    const staff = await scopedSession(app, handle, { name: 'modeler_staff', codes: ['system_settings'], dataScope: 'all' })
    expect((await staff.inject({ url: `${BASE}/meta` })).json()).toEqual({ error: '在线建模只对超级管理员开放' })
    const res = await app.inject({ url: `${BASE}/meta`, headers: { authorization: 'Bearer ck_whatever' } })
    expect([401, 403]).toContain(res.statusCode)
  })

  it('meta：字段类型、父菜单、字典、AI 是否配置', async () => {
    const meta = (await admin.inject({ url: `${BASE}/meta` })).json()
    expect(meta.types).toEqual(expect.arrayContaining(['str', 'enum', 'dict', 'image']))
    expect(meta.parents.map((p: { code: string }) => p.code)).toEqual(expect.arrayContaining(['system', 'system_group_org']))
    expect(meta.ai_configured).toBe(false)
    expect(meta.running).toBeNull()
  })

  it('validate：spec 的问题与已存在的模块', async () => {
    expect((await admin.inject({ method: 'POST', url: `${BASE}/validate`, payload: { spec } })).json()).toEqual({ errors: [] })
    const taken = await admin.inject({ method: 'POST', url: `${BASE}/validate`, payload: { spec: { ...spec, name: 'users' } } })
    expect(taken.json()).toEqual({ errors: ['模块 users 已存在，请换一个模块名'] })
    const bad = await admin.inject({ method: 'POST', url: `${BASE}/validate`, payload: { spec: { ...spec, fields: [] } } })
    expect(bad.json()).toEqual({ errors: ['至少需要一个字段'] })
    // Translated like any API error
    const en = await admin.inject({ method: 'POST', url: `${BASE}/jobs`, headers: { 'accept-language': 'en-US' }, payload: { spec: { ...spec, name: 'users' } } })
    expect(en.json()).toMatchObject({ error: 'Module users already exists. Choose another name.' })
  })

  it('生成需要近期验证身份；有任务在跑时拒绝新任务', async () => {
    await handle.db.update(sessions).set({ verified_at: '2000-01-01 00:00:00' }).where(eq(sessions.user_id, admin.userId))
    expect((await admin.inject({ method: 'POST', url: `${BASE}/jobs`, payload: { spec } })).json()).toMatchObject({ reauth_required: true })
    admin = await superAdminSession(app, handle)

    // A live process holds the lock (this test process itself)
    writeLock('job-held', process.pid)
    try {
      const busy = await admin.inject({ method: 'POST', url: `${BASE}/jobs`, payload: { spec } })
      expect([busy.statusCode, busy.json()]).toEqual([409, { error: '已有建模任务在运行，请等它结束' }])
      expect((await admin.inject({ method: 'POST', url: `${BASE}/modules/nope/undo` })).statusCode).toBe(404)
    } finally {
      releaseLock('job-held')
    }
    // A lock left by a process that is gone doesn't block
    writeLock('job-dead', 999_999)
    expect((await admin.inject({ url: `${BASE}/meta` })).json().running).toBeNull()
  })

  it('轮询任务：状态与日志按偏移增量返回；不存在的任务 404', async () => {
    const state: JobState = {
      id: 'job-1',
      kind: 'generate',
      module: 'ck_modeler_probe',
      title: '探针',
      status: 'running',
      steps: [{ key: 'scaffold', label: '生成代码', status: 'running' }],
      error: null,
      rolledBack: false,
      created_at: '2026-01-01T00:00:00',
      finished_at: null,
    }
    writeState(state)
    const { appendFileSync } = await import('node:fs')
    appendFileSync(join(dir, 'jobs', 'job-1', 'log.txt'), 'first line\n')
    const one = (await admin.inject({ url: `${BASE}/jobs/job-1` })).json()
    expect(one.job.status).toBe('running')
    expect(one.log).toEqual({ text: 'first line\n', offset: 11 })
    appendFileSync(join(dir, 'jobs', 'job-1', 'log.txt'), '第二行\n')
    expect((await admin.inject({ url: `${BASE}/jobs/job-1?offset=11` })).json().log).toEqual({ text: '第二行\n', offset: 21 })
    expect((await admin.inject({ url: `${BASE}/jobs/../../etc` })).statusCode).toBe(404)
    expect((await admin.inject({ url: `${BASE}/jobs/job-missing` })).json()).toEqual({ error: '任务不存在' })
    expect((await admin.inject({ url: `${BASE}/history` })).json().jobs.map((j: JobState) => j.id)).toContain('job-1')
  })

  it('AI：一句话生成字段清单与译文；翻译', async () => {
    const up = await startFakeUpstream()
    const withAi = await buildTestApp({ modelerEnabled: true, settingsEnv: { AI_API_BASE: up.url, AI_API_KEY: 'k', AI_MODEL: 'm' } })
    try {
      const s = await superAdminSession(withAi, handle)
      const suggested = (await s.inject({ method: 'POST', url: `${BASE}/ai/suggest`, payload: { description: '做一个资产台账' } })).json()
      expect(suggested.errors).toEqual([])
      expect(suggested.spec).toMatchObject({
        name: 'ck_ai_asset',
        title: '资产',
        fields: [
          { name: 'code', type: 'str50', label: '资产编号', required: true, unique: true },
          { name: 'status', type: 'enum', default: 'idle', options: [{ value: 'idle', label: '闲置' }] },
        ],
        i18n: { 'en-US': { 资产: 'Assets' }, 'ja-JP': { 资产: '資産' } },
      })
      expect(suggested.spec.fields[0]).not.toHaveProperty('options')
      // The prompt carries the JSON shape (OpenAI-compatible APIs only get JSON mode)
      expect(JSON.stringify(up.requests.at(-1)!.body.messages)).toContain('只输出一个 JSON 对象')
      const translated = (await s.inject({ method: 'POST', url: `${BASE}/ai/translate`, payload: { texts: ['名称', '名称', '状态'] } })).json()
      expect(translated.items).toEqual([
        { zh: '名称', en: 'en:名称', ja: 'ja:名称' },
        { zh: '状态', en: 'en:状态', ja: 'ja:状态' },
      ])
    } finally {
      await withAi.close()
      await up.close()
    }
    admin = await superAdminSession(app, handle)
  })

  it('AI：没配置模型时给出提示', async () => {
    const res = await admin.inject({ method: 'POST', url: `${BASE}/ai/suggest`, payload: { description: '设备台账' } })
    expect(res.json()).toEqual({ error: '未配置 AI 模型，请在「系统设置 → AI」中填写 API Key 和模型名' })
    expect((await admin.inject({ method: 'POST', url: `${BASE}/ai/suggest`, payload: { description: ' ' } })).json()).toEqual({ error: '请描述要做的功能' })
  })
})
