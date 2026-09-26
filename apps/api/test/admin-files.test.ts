import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq, inArray, sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { syncFileRefs, clearFileRefs, fileIdOf } from '@/common/file-refs'
import { Storage } from '@/common/storage'
import type { DbHandle } from '@/db/client'
import { file_references, files } from '@/db/schema'
import { FileService } from '@/modules/admin/files/service'
import { startFakeS3, type FakeS3 } from './fake-s3'
import {
  buildTestApp,
  cleanupFixture,
  createFixture,
  FIXTURE_PASSWORD,
  FIXTURE_USER,
  loginSession,
  multipartFile,
  openTestDb,
  superAdminSession,
  testConfig,
  type AuthedSession,
} from './helpers'

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)
const PDF = Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n')

let handle: DbHandle
const createdIds: string[] = []
const tempDirs: string[] = []

function storageConfig(overrides: Partial<ReturnType<typeof testConfig>['storage']> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ck-files-'))
  tempDirs.push(dir)
  return { ...testConfig().storage, localDir: dir, ...overrides }
}

/** All object files under a local storage root */
function objectsIn(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name)
}

async function upload(s: AuthedSession, name: string, content: Buffer | string) {
  const res = await s.inject({ method: 'POST', url: '/api/admin/files', ...multipartFile(name, content) })
  if (res.statusCode === 201) createdIds.push(res.json().id)
  return res
}

beforeAll(() => {
  handle = openTestDb()
})

afterAll(async () => {
  if (createdIds.length) await handle.db.delete(files).where(inArray(files.id, createdIds))
  await cleanupFixture(handle)
  await handle.pool.end()
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
})

describe('files: local driver', () => {
  let app: FastifyInstance
  let s: AuthedSession
  let storage: ReturnType<typeof storageConfig>

  beforeAll(async () => {
    storage = storageConfig({ uploadMaxSize: 64 * 1024 })
    app = await buildTestApp({ storage })
    s = await superAdminSession(app, handle)
  })
  afterAll(() => app.close())

  it('上传图片 → 201；内联预览、ETag 命中 304、?download=1 变为附件', async () => {
    const res = await upload(s, 'pixel.png', PNG)
    expect(res.statusCode, res.body).toBe(201)
    const file = res.json()
    expect(file).toMatchObject({ original_name: 'pixel.png', mime_type: 'image/png', size: PNG.length, storage: 'local', ref_count: 0 })
    expect(file.url).toBe(`/api/admin/files/${file.id}`)

    const get = await s.inject({ url: file.url })
    expect(get.statusCode).toBe(200)
    expect(get.rawPayload.equals(PNG)).toBe(true)
    expect(get.headers['content-type']).toBe('image/png')
    expect(get.headers['content-disposition']).toMatch(/^inline; filename="pixel.png"/)
    expect(get.headers['x-content-type-options']).toBe('nosniff')
    const etag = get.headers.etag as string
    expect((await s.inject({ url: file.url, headers: { 'if-none-match': etag } })).statusCode).toBe(304)
    expect((await s.inject({ url: `${file.url}?download=1` })).headers['content-disposition']).toMatch(/^attachment;/)
  })

  it('相同内容去重：两条记录共用一个对象，删到最后一条才删对象', async () => {
    const before = objectsIn(storage.localDir).length
    const a = (await upload(s, '副本一.pdf', PDF)).json()
    const b = (await upload(s, '副本二.pdf', PDF)).json()
    expect(a.id).not.toBe(b.id)
    expect(a.sha256).toBe(b.sha256)
    expect(objectsIn(storage.localDir).length).toBe(before + 1)
    // Non-image types are always attachments; the UTF-8 name is kept
    const get = await s.inject({ url: a.url })
    expect(get.headers['content-disposition']).toContain(`filename*=UTF-8''${encodeURIComponent('副本一.pdf')}`)
    expect(get.headers['content-disposition']).toMatch(/^attachment;/)

    expect((await s.inject({ method: 'DELETE', url: a.url })).json()).toEqual({ message: '删除成功' })
    expect(objectsIn(storage.localDir).length).toBe(before + 1)
    await s.inject({ method: 'DELETE', url: b.url })
    expect(objectsIn(storage.localDir).length).toBe(before)
  })

  it('校验：类型不在白名单 / 内容与扩展名不符 / 无扩展名 / 空文件 / 超过大小 / 没有文件', async () => {
    const reason = async (name: string, content: Buffer | string) => [(await upload(s, name, content)).statusCode, (await upload(s, name, content)).json().error]
    expect(await reason('run.exe', 'MZ')).toEqual([400, '不支持的文件类型：.exe'])
    expect(await reason('fake.png', 'plain text')).toEqual([400, '文件内容与扩展名不符'])
    expect(await reason('notes.txt', PNG)).toEqual([400, '文件内容与扩展名不符'])
    expect(await reason('README', 'x')).toEqual([400, '文件缺少扩展名，无法判断类型'])
    expect(await reason('empty.txt', '')).toEqual([400, '文件内容为空'])
    expect(await reason('big.txt', 'x'.repeat(64 * 1024 + 1))).toEqual([413, '文件过大，最大支持 0.1MB'])
    const none = await s.inject({ method: 'POST', url: '/api/admin/files' })
    expect(none.json()).toEqual({ error: '请选择要上传的文件' })

    const txt = await upload(s, '../../etc/说明.txt', '你好')
    expect(txt.json()).toMatchObject({ original_name: '说明.txt', mime_type: 'text/plain' })
  })

  it('列表：权限、搜索、类型、是否被引用；详情带引用位置', async () => {
    const png = (await upload(s, 'list-probe.png', PNG)).json()
    await syncFileRefs(handle.db, 'ck_test_things', 7, { cover: png.url })

    const list = (await s.inject({ url: '/api/admin/files?search=list-probe' })).json()
    expect(list.items.map((f: { id: string }) => f.id)).toEqual([png.id])
    expect(list.items[0]).toMatchObject({ ref_count: 1, uploader_name: 'ck_test_super' })
    expect((await s.inject({ url: '/api/admin/files?search=list-probe&kind=document' })).json().total).toBe(0)
    expect((await s.inject({ url: '/api/admin/files?search=list-probe&referenced=no' })).json().total).toBe(0)
    expect((await s.inject({ url: '/api/admin/files?search=list-probe&referenced=yes&kind=image' })).json().total).toBe(1)

    const info = (await s.inject({ url: `${png.url}/info` })).json()
    expect(info.references).toEqual([{ ref_table: 'ck_test_things', ref_id: '7', ref_field: 'cover' }])
    const del = await s.inject({ method: 'DELETE', url: png.url })
    expect([del.statusCode, del.json()]).toEqual([400, { error: '文件正在被使用，不能删除' }])
    await clearFileRefs(handle.db, 'ck_test_things', 7)
    expect((await s.inject({ method: 'DELETE', url: png.url })).statusCode).toBe(200)
  })

  it('头像：个人资料 / 编辑用户保存上传的头像时登记引用，换成外部地址或删除用户时解除', async () => {
    const avatar = (await upload(s, 'face.png', PNG)).json()
    const refsOf = async (userId: number) =>
      (await handle.db.select().from(file_references).where(eq(file_references.ref_table, 'admin_users')))
        .filter((r) => r.ref_id === String(userId))
        .map((r) => [r.file_id, r.ref_field])

    expect((await s.inject({ method: 'PUT', url: '/api/admin/profile', payload: { avatar: avatar.url } })).statusCode).toBe(200)
    expect(await refsOf(s.userId)).toEqual([[avatar.id, 'avatar']])
    expect((await s.inject({ url: `${avatar.url}/info` })).json().ref_count).toBe(1)
    await s.inject({ method: 'PUT', url: '/api/admin/profile', payload: { avatar: 'https://example.com/me.png' } })
    expect(await refsOf(s.userId)).toEqual([])

    const created = await s.inject({
      method: 'POST',
      url: '/api/admin/users',
      payload: { username: 'ck_test_f_avatar', password: 'x-pass-1', avatar: avatar.url },
    })
    const userId = created.json().id
    expect(await refsOf(userId)).toEqual([[avatar.id, 'avatar']])
    await s.inject({ method: 'DELETE', url: `/api/admin/users/${userId}` })
    expect(await refsOf(userId)).toEqual([])
  })

  it('权限：未登录 401；普通用户能上传和读取，但看不到列表、不能删除；非法 id → 404', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/admin/files', ...multipartFile('a.png', PNG) })).statusCode).toBe(401)
    const fx = await createFixture(handle)
    const u = await loginSession(app, FIXTURE_USER, FIXTURE_PASSWORD, fx.userId)
    const mine = await upload(u, 'mine.png', PNG)
    expect(mine.statusCode).toBe(201)
    expect((await u.inject({ url: mine.json().url })).statusCode).toBe(200)
    expect((await u.inject({ url: '/api/admin/files' })).json()).toEqual({ error: '无权限查看文件列表' })
    expect((await u.inject({ method: 'DELETE', url: mine.json().url })).json()).toEqual({ error: '无权限删除文件' })
    expect((await u.inject({ url: '/api/admin/files/not-a-uuid' })).statusCode).toBe(404)
    expect((await u.inject({ url: '/api/admin/files/00000000-0000-4000-8000-000000000000' })).statusCode).toBe(404)
  })
})

describe('files: s3 driver（进程内假 S3）', () => {
  let s3: FakeS3
  let app: FastifyInstance
  let s: AuthedSession

  beforeAll(async () => {
    s3 = await startFakeS3()
    const s3Config = { endpoint: s3.url, region: 'us-east-1', bucket: 'ck-bucket', accessKey: 'ak', secretKey: 'sk', publicUrl: '', forcePathStyle: true }
    app = await buildTestApp({ storage: storageConfig({ driver: 's3', s3: s3Config }) })
    s = await superAdminSession(app, handle)
  })
  afterAll(async () => {
    await app.close()
    await s3.close()
  })

  it('上传写入桶；下载 302 到带签名的地址，签名地址能取回内容；删除时删对象', async () => {
    const file = (await upload(s, 'cloud.pdf', PDF)).json()
    expect(file.storage).toBe('s3')
    const key = `ck-bucket/${file.sha256.slice(0, 2)}/${file.sha256}`
    expect(s3.objects.get(key)?.body.equals(PDF)).toBe(true)
    expect(s3.objects.get(key)?.contentType).toBe('application/pdf')

    const res = await s.inject({ url: file.url })
    expect(res.statusCode).toBe(302)
    const location = new URL(res.headers.location as string)
    expect(location.origin).toBe(s3.url)
    expect(location.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/)
    expect(location.searchParams.get('X-Amz-Expires')).toBe('600')
    expect(location.searchParams.get('response-content-disposition')).toMatch(/^attachment; filename="cloud.pdf"/)
    const fetched = await fetch(location)
    expect(Buffer.from(await fetched.arrayBuffer()).equals(PDF)).toBe(true)

    await s.inject({ method: 'DELETE', url: file.url })
    expect(s3.objects.has(key)).toBe(false)
  })

  it('配置了 S3_PUBLIC_URL 时直接跳到公开地址', async () => {
    const file = (await upload(s, 'public.png', PNG)).json()
    const storage = new Storage({ ...storageConfig(), driver: 's3', s3: { ...testConfig().storage.s3, bucket: 'b', accessKey: 'a', secretKey: 's', publicUrl: 'https://cdn.example.com' } })
    const download = await storage.get('s3').download(`${file.sha256.slice(0, 2)}/${file.sha256}`, { filename: 'x', contentType: 'image/png', inline: true })
    expect(download).toEqual({ kind: 'redirect', url: `https://cdn.example.com/${file.sha256.slice(0, 2)}/${file.sha256}` })
  })
})

describe('files: 孤儿清理与引用', () => {
  it('超过 24 小时且没有引用的文件被清理；有引用的、刚上传的保留', async () => {
    const config = storageConfig()
    const service = new FileService(handle.db, new Storage(config), config)
    const upload = (name: string, data: Buffer) => service.upload({ filename: name, data }, null)
    const oldOrphan = await upload('old.txt', Buffer.from('old orphan'))
    const oldUsed = await upload('used.txt', Buffer.from('old but used'))
    const fresh = await upload('fresh.txt', Buffer.from('fresh'))
    createdIds.push(oldOrphan.id, oldUsed.id, fresh.id)
    await handle.db
      .update(files)
      .set({ created_at: sql`timezone('utc', now()) - interval '25 hours'` })
      .where(inArray(files.id, [oldOrphan.id, oldUsed.id]))
    await syncFileRefs(handle.db, 'ck_test_things', 'abc', { attachment: oldUsed.id })

    expect(await service.cleanupOrphans()).toBeGreaterThanOrEqual(1)
    const left = (await handle.db.select({ id: files.id }).from(files).where(inArray(files.id, [oldOrphan.id, oldUsed.id, fresh.id]))).map((r) => r.id)
    expect(left.sort()).toEqual([oldUsed.id, fresh.id].sort())
    expect(objectsIn(config.localDir)).toHaveLength(2)
    await clearFileRefs(handle.db, 'ck_test_things', 'abc')
  })

  it('syncFileRefs：接受 id 或文件地址；外部地址与不存在的 id 只清除引用', async () => {
    const config = storageConfig()
    const service = new FileService(handle.db, new Storage(config), config)
    const file = await service.upload({ filename: 'ref.txt', data: Buffer.from('ref') }, null)
    createdIds.push(file.id)
    expect(fileIdOf(file.url)).toBe(file.id)
    expect(fileIdOf('https://example.com/a.png')).toBeNull()

    const refs = () => handle.db.select().from(file_references).where(eq(file_references.ref_table, 'ck_test_refs'))
    await syncFileRefs(handle.db, 'ck_test_refs', 1, { avatar: file.url })
    expect((await refs()).map((r) => r.file_id)).toEqual([file.id])
    await syncFileRefs(handle.db, 'ck_test_refs', 1, { avatar: 'https://example.com/a.png' })
    expect(await refs()).toEqual([])
    await syncFileRefs(handle.db, 'ck_test_refs', 1, { avatar: '00000000-0000-4000-8000-000000000000', other: undefined })
    expect(await refs()).toEqual([])
  })
})
