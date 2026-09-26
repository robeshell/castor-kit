/**
 * The s3 driver against a real S3-compatible service (MinIO, R2, AWS ...). Skipped unless S3_TEST_ENDPOINT is set:
 *
 *   S3_TEST_ENDPOINT=http://127.0.0.1:9000 S3_TEST_ACCESS_KEY=... S3_TEST_SECRET_KEY=... \
 *     pnpm --filter @castor-kit/api exec vitest run test/files-s3-live.test.ts
 *
 * Creates (and afterwards empties and removes) a throwaway bucket unless S3_TEST_BUCKET names an existing one.
 */

import { CreateBucketCommand, DeleteBucketCommand, DeleteObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { inArray } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DbHandle } from '@/db/client'
import { files } from '@/db/schema'
import { buildTestApp, multipartFile, openTestDb, superAdminSession, type AuthedSession } from './helpers'

const endpoint = process.env.S3_TEST_ENDPOINT ?? ''
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

describe.skipIf(!endpoint)('files: s3 driver against a live endpoint', () => {
  const ownBucket = !process.env.S3_TEST_BUCKET
  const bucket = process.env.S3_TEST_BUCKET || `castor-test-${Date.now()}`
  const s3 = {
    endpoint,
    region: process.env.S3_TEST_REGION || 'us-east-1',
    bucket,
    accessKey: process.env.S3_TEST_ACCESS_KEY ?? '',
    secretKey: process.env.S3_TEST_SECRET_KEY ?? '',
    publicUrl: '',
    forcePathStyle: true,
  }
  const client = new S3Client({
    region: s3.region,
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: s3.accessKey, secretAccessKey: s3.secretKey },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
  const ids: string[] = []
  let handle: DbHandle
  let app: FastifyInstance
  let s: AuthedSession

  beforeAll(async () => {
    if (ownBucket) await client.send(new CreateBucketCommand({ Bucket: bucket }))
    handle = openTestDb()
    app = await buildTestApp({
      settingsEnv: {
        STORAGE_DRIVER: 's3',
        S3_ENDPOINT: endpoint,
        S3_REGION: s3.region,
        S3_BUCKET: s3.bucket,
        S3_ACCESS_KEY: s3.accessKey,
        S3_SECRET_KEY: s3.secretKey,
        S3_FORCE_PATH_STYLE: 'true',
      },
    })
    s = await superAdminSession(app, handle)
  })

  afterAll(async () => {
    if (ids.length) await handle.db.delete(files).where(inArray(files.id, ids))
    const listed = await client.send(new ListObjectsV2Command({ Bucket: bucket }))
    for (const o of listed.Contents ?? []) await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: o.Key! }))
    if (ownBucket) await client.send(new DeleteBucketCommand({ Bucket: bucket }))
    await app.close()
    await handle.pool.end()
  })

  it('上传 → 签名地址下载内容一致、带文件名 → 相同内容只存一份 → 删除最后一条时删对象', async () => {
    const up = async (name: string) => {
      const res = await s.inject({ method: 'POST', url: '/api/admin/files', ...multipartFile(name, PNG) })
      expect(res.statusCode, res.body).toBe(201)
      ids.push(res.json().id)
      return res.json()
    }
    const a = await up('第一张.png')
    const b = await up('second.png')
    const key = `${a.sha256.slice(0, 2)}/${a.sha256}`
    const objects = async () => ((await client.send(new ListObjectsV2Command({ Bucket: bucket }))).Contents ?? []).map((o) => o.Key)
    expect(await objects()).toEqual([key])

    const redirect = await s.inject({ url: a.url })
    expect(redirect.statusCode).toBe(302)
    const fetched = await fetch(redirect.headers.location as string)
    expect(fetched.status).toBe(200)
    expect(Buffer.from(await fetched.arrayBuffer()).equals(PNG)).toBe(true)
    expect(fetched.headers.get('content-type')).toBe('image/png')
    expect(fetched.headers.get('content-disposition')).toContain(`filename*=UTF-8''${encodeURIComponent('第一张.png')}`)

    // A tampered signature is rejected by the service
    const tampered = new URL(redirect.headers.location as string)
    tampered.searchParams.set('X-Amz-Signature', '0'.repeat(64))
    expect((await fetch(tampered)).status).toBe(403)

    await s.inject({ method: 'DELETE', url: a.url })
    expect(await objects()).toEqual([key])
    await s.inject({ method: 'DELETE', url: b.url })
    expect(await objects()).toEqual([])
  })
})
