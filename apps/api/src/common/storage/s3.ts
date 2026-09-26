/**
 * S3 driver: any S3-compatible service (AWS S3, MinIO, Aliyun OSS, Tencent COS, Cloudflare R2).
 * Downloads redirect to a short-lived signed URL, or to the bucket's public URL when one is set.
 */

import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { Settings } from '@/common/settings'
import { assertObjectKey, contentDisposition, type Download, type DownloadOptions, type StorageDriver } from './types'

/** Lifetime of signed download URLs */
export const SIGNED_URL_SECONDS = 600

export class S3Storage implements StorageDriver {
  readonly name = 's3' as const
  readonly bucket: string
  private readonly client: S3Client
  private readonly publicUrl: string

  /**
   * `quick`: one attempt with short timeouts (the settings page's connection test answers within seconds instead of
   * retrying an unreachable host); normal use keeps the SDK's retries
   */
  constructor(config: Settings['storage']['s3'], options: { quick?: boolean } = {}) {
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
      ...(options.quick ? { maxAttempts: 1 } : {}),
      requestHandler: options.quick ? { connectionTimeout: 8_000, requestTimeout: 15_000 } : { connectionTimeout: 15_000 },
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

  async delete(key: string, bucket?: string | null): Promise<void> {
    assertObjectKey(key)
    await this.client.send(new DeleteObjectCommand({ Bucket: bucket || this.bucket, Key: key }))
  }

  async download(key: string, options: DownloadOptions): Promise<Download> {
    assertObjectKey(key)
    if (this.publicUrl) return { kind: 'redirect', url: `${this.publicUrl}/${key}` }
    const command = new GetObjectCommand({
      Bucket: options.bucket || this.bucket,
      Key: key,
      ResponseContentType: options.contentType,
      ResponseContentDisposition: contentDisposition(options.filename, options.inline),
    })
    return { kind: 'redirect', url: await getSignedUrl(this.client, command, { expiresIn: SIGNED_URL_SECONDS }) }
  }
}
