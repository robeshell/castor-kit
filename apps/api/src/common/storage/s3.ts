/**
 * S3 driver: any S3-compatible service (AWS S3, MinIO, Aliyun OSS, Tencent COS, Cloudflare R2).
 * Downloads redirect to a short-lived signed URL, or to S3_PUBLIC_URL when the bucket is public.
 */

import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { StorageConfig } from '@/config'
import { assertObjectKey, contentDisposition, type Download, type DownloadOptions, type StorageDriver } from './types'

/** Lifetime of signed download URLs */
export const SIGNED_URL_SECONDS = 600

export class S3Storage implements StorageDriver {
  readonly name = 's3' as const
  readonly bucket: string
  private readonly client: S3Client
  private readonly publicUrl: string

  constructor(config: StorageConfig['s3']) {
    this.bucket = config.bucket
    this.publicUrl = config.publicUrl
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint || undefined,
      forcePathStyle: config.forcePathStyle,
      credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey },
      // Newer SDKs add checksums to every request by default, which several S3-compatible services reject
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    })
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    assertObjectKey(key)
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: contentType }))
  }

  async exists(key: string): Promise<boolean> {
    assertObjectKey(key)
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
      return true
    } catch (err) {
      const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
      if (status === 404 || (err as Error).name === 'NotFound') return false
      throw err
    }
  }

  async delete(key: string): Promise<void> {
    assertObjectKey(key)
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }

  async download(key: string, options: DownloadOptions): Promise<Download> {
    assertObjectKey(key)
    if (this.publicUrl) return { kind: 'redirect', url: `${this.publicUrl}/${key}` }
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentType: options.contentType,
      ResponseContentDisposition: contentDisposition(options.filename, options.inline),
    })
    return { kind: 'redirect', url: await getSignedUrl(this.client, command, { expiresIn: SIGNED_URL_SECONDS }) }
  }
}
