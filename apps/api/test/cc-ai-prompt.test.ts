import { eq, like } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DbHandle } from '@/db/client'
import { ai_prompt_templates } from '@/db/schema'
import { extractVariables, findVariables, normalizeTags, SEED_TEMPLATES } from '@/modules/component-center/ai-prompt/schema'
import {
  buildTestApp,
  cleanupFixture,
  createFixture,
  FIXTURE_PASSWORD,
  FIXTURE_USER,
  loginSession,
  openTestDb,
  superAdminSession,
  type AuthedSession,
} from './helpers'

const P = 'ck_test_r3_ap_'
const B = '/api/admin/component-center/ai/prompt'
let app: FastifyInstance
let handle: DbHandle
let s: AuthedSession
let noPerm: AuthedSession

async function cleanupRows() {
  await handle.db.delete(ai_prompt_templates).where(like(ai_prompt_templates.name, `${P}%`))
}

beforeAll(async () => {
  handle = openTestDb()
  app = await buildTestApp()
  // createFixture first cleans up all ck_test_ users, so it must run before superAdminSession
  await createFixture(handle)
  s = await superAdminSession(app, handle)
  noPerm = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD)
  await cleanupRows()
})

afterAll(async () => {
  await cleanupRows()
  await cleanupFixture(handle)
  await app.close()
  await handle.pool.end()
})

describe('ai-prompt 纯函数', () => {
  it('变量提取（Unicode \\w、首次出现去重）/ tags 归一化', () => {
    expect(findVariables('{{a}} {{中文}} {{a}} {{ b }} {{}} {{x-y}} {{Ⅻ}}')).toEqual(['a', '中文', 'a', 'Ⅻ'])
    expect(extractVariables('{{b}}{{a}}{{b}}')).toEqual(['b', 'a'])
    expect(normalizeTags([' a ', '', 2, null, true])).toBe('a,2,None,True')
    expect(normalizeTags(' x ,, y ')).toBe('x,y')
    expect(normalizeTags(5)).toBe('5')
    expect(normalizeTags(null)).toBe('')
  })
})

describe('ai-prompt', () => {
  it('列表：{data,total}、内置模板按名称补齐、分类筛选', async () => {
    const seedName = SEED_TEMPLATES[4]!.name
    await handle.db.delete(ai_prompt_templates).where(eq(ai_prompt_templates.name, seedName))
    const res = await s.inject({ url: `${B}/templates` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Object.keys(body).sort()).toEqual(['data', 'total'])
    expect(body.total).toBe(body.data.length)
    const names = body.data.map((t: { name: string }) => t.name)
    for (const seed of SEED_TEMPLATES) expect(names).toContain(seed.name)
    const reseeded = body.data.find((t: { name: string }) => t.name === seedName)
    expect(reseeded).toMatchObject({
      category: 'office',
      variables: ['meeting_topic', 'participants', 'meeting_time', 'raw_notes'],
      tags: ['办公', '效率'],
      is_active: true,
    })
    const [row] = await handle.db
      .select({ v: ai_prompt_templates.variables })
      .from(ai_prompt_templates)
      .where(eq(ai_prompt_templates.name, seedName))
    expect(row!.v).toEqual(['meeting_topic', 'participants', 'meeting_time', 'raw_notes'])
    // No duplicate insert
    const again = (await s.inject({ url: `${B}/templates` })).json()
    expect(again.total).toBe(body.total)

    const dev = (await s.inject({ url: `${B}/templates?category=%20dev%20` })).json()
    expect(dev.data.every((t: { category: string }) => t.category === 'dev')).toBe(true)
    expect(dev.total).toBeGreaterThan(0)
  })

  it('权限 403（先于 404）', async () => {
    const checks: [string, string, string][] = [
      ['GET', `${B}/templates`, '无权限'],
      ['POST', `${B}/templates`, '无权限新建模板'],
      ['PUT', `${B}/templates/99999999`, '无权限编辑模板'],
      ['DELETE', `${B}/templates/99999999`, '无权限删除模板'],
      ['POST', `${B}/preview`, '无权限'],
    ]
    for (const [method, url, error] of checks) {
      const res = await noPerm.inject({ method: method as 'GET', url, ...(method === 'GET' || method === 'DELETE' ? {} : { payload: {} }) })
      expect(res.statusCode, url).toBe(403)
      expect(res.json()).toEqual({ error })
    }
  })

  it('新增 201：strip / 变量提取 / tags / is_active 默认', async () => {
    const res = await s.inject({
      method: 'POST',
      url: `${B}/templates`,
      payload: { name: ` ${P}a `, content: ' 你好 {{who}}，{{when}} {{who}} ', category: ' ', description: '', tags: ['x', ' y '], is_active: null },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body).toMatchObject({
      name: `${P}a`,
      content: '你好 {{who}}，{{when}} {{who}}',
      category: 'custom',
      description: null,
      variables: ['who', 'when'],
      tags: ['x', 'y'],
      is_active: true,
    })
    expect(body.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    const raw = await handle.pool.query('select variables::text as v from ai_prompt_templates where id = $1', [body.id])
    expect(raw.rows[0].v).toBe('["who", "when"]')

    const off = await s.inject({ method: 'POST', url: `${B}/templates`, payload: { name: `${P}b`, content: 'c', is_active: 0, category: 'dev', description: ' d ' } })
    expect(off.json()).toMatchObject({ is_active: false, category: 'dev', description: 'd', variables: [], tags: [] })
  })

  it('新增 失败分支：400 / 保存失败 500（具体文案）/ 类型错误 500（通用文案）', async () => {
    for (const payload of [{}, { name: 'x' }, { name: ' ', content: 'y' }, { name: 'x', content: 0 }]) {
      const res = await s.inject({ method: 'POST', url: `${B}/templates`, payload })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({ error: '模板名称和内容不能为空' })
    }
    for (const payload of [
      { name: `${P}x`, content: 'y', is_active: 'yes' },
      { name: `${P}x`, content: 'y', is_active: 2 },
      { name: `${P}x`, content: 'y', is_active: [] },
      { name: `${P}x${'n'.repeat(120)}`, content: 'y' },
    ]) {
      const res = await s.inject({ method: 'POST', url: `${B}/templates`, payload })
      expect(res.statusCode).toBe(500)
      expect(res.json()).toEqual({ error: '保存模板失败，请稍后重试' })
    }
    for (const payload of [
      { name: 5, content: 'y' },
      { name: 'x', content: ['y'] },
      { name: `${P}x`, content: 'y', category: 5 },
      { name: `${P}x`, content: 'y', description: true },
    ]) {
      const res = await s.inject({ method: 'POST', url: `${B}/templates`, payload })
      expect(res.statusCode).toBe(500)
      expect(res.json()).toEqual({ error: '服务器内部错误，请稍后重试' })
    }
    expect(await handle.db.select().from(ai_prompt_templates).where(eq(ai_prompt_templates.name, `${P}x`))).toHaveLength(0)
  })

  it('编辑：字段更新 + 变量重算；无变化不更新 updated_at；400；404 模板不存在', async () => {
    const [a] = await handle.db.select().from(ai_prompt_templates).where(eq(ai_prompt_templates.name, `${P}a`))
    const res = await s.inject({
      method: 'PUT',
      url: `${B}/templates/${a!.id}`,
      payload: { content: '{{x}} {{y}}', category: null, description: 5, tags: 'p, q', is_active: 'no' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toMatchObject({ content: '{{x}} {{y}}', category: 'custom', description: '5', tags: ['p', 'q'], is_active: true, variables: ['x', 'y'] })
    expect(body.updated_at).not.toBe(toIsoLike(a!.updated_at))

    const same = await s.inject({ method: 'PUT', url: `${B}/templates/${a!.id}`, payload: { name: ` ${P}a `, tags: ['p', 'q'] } })
    expect(same.json().updated_at).toBe(body.updated_at)

    const off = await s.inject({ method: 'PUT', url: `${B}/templates/${a!.id}`, payload: { is_active: 0 } })
    expect(off.json().is_active).toBe(false)

    expect((await s.inject({ method: 'PUT', url: `${B}/templates/${a!.id}`, payload: { name: '' } })).json()).toEqual({ error: '模板名称不能为空' })
    expect((await s.inject({ method: 'PUT', url: `${B}/templates/${a!.id}`, payload: { content: null } })).json()).toEqual({ error: '模板内容不能为空' })
    const tooLong = await s.inject({ method: 'PUT', url: `${B}/templates/${a!.id}`, payload: { name: 'n'.repeat(121) } })
    expect(tooLong.statusCode).toBe(500)
    expect(tooLong.json()).toEqual({ error: '保存模板失败，请稍后重试' })

    for (const id of ['99999999', '99999999999']) {
      const nf = await s.inject({ method: 'PUT', url: `${B}/templates/${id}`, payload: {} })
      expect(nf.statusCode).toBe(404)
      expect(nf.json()).toEqual({ error: '模板不存在' })
    }
    expect((await s.inject({ method: 'PUT', url: `${B}/templates/abc`, payload: {} })).statusCode).toBe(405)
  })

  it('删除 + 404', async () => {
    const [b] = await handle.db.select().from(ai_prompt_templates).where(eq(ai_prompt_templates.name, `${P}b`))
    expect((await s.inject({ method: 'DELETE', url: `${B}/templates/${b!.id}` })).json()).toEqual({ message: '删除成功' })
    const again = await s.inject({ method: 'DELETE', url: `${B}/templates/${b!.id}` })
    expect(again.statusCode).toBe(404)
    expect(again.json()).toEqual({ error: '模板不存在' })
  })

  it('预览：逐个替换、str() 语义、未定义变量；非对象 variables / 非字符串 content → 500', async () => {
    const res = await s.inject({
      method: 'POST',
      url: `${B}/preview`,
      payload: { content: 'a {{x}} {{y}} {{x}} {{中文}} {{z}} {{ w }} {{}}', variables: { x: 1, y: null, '': 'E', b: true, 中文: [1, 'a'] } },
    })
    expect(res.json()).toEqual({ preview: "a 1 None 1 [1, 'a'] {{z}} {{ w }} E", undefined_vars: ['z'] })
    expect((await s.inject({ method: 'POST', url: `${B}/preview`, payload: {} })).json()).toEqual({ preview: '', undefined_vars: [] })
    for (const payload of [{ content: '{{a}}', variables: ['a'] }, { content: 5 }, { content: 'x', variables: 'a' }]) {
      const r = await s.inject({ method: 'POST', url: `${B}/preview`, payload })
      expect(r.statusCode).toBe(500)
      expect(r.json()).toEqual({ error: '服务器内部错误，请稍后重试' })
    }
  })
})

function toIsoLike(v: string | null): string | null {
  return v ? v.replace(' ', 'T') : v
}
