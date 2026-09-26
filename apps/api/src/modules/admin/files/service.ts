/**
 * Files module service layer
 *
 * Upload: size → extension allow-list → signature check (file-type) → sha256 → store the object once per content →
 * one files row per upload. Serving: images inline, everything else as an attachment; s3 redirects to a signed URL.
 */

import { createHash } from 'node:crypto'
import { fileTypeFromBuffer } from 'file-type'
import { ServiceError } from '@/common/errors'
import { isUuid } from '@/common/file-refs'
import { notFound } from '@/common/http'
import { contentDisposition, objectKeyFor, type Download, type Storage } from '@/common/storage'
import type { UploadedFile } from '@/common/tabular'
import type { StorageConfig } from '@/config'
import type { Db } from '@/db/client'
import { fileToDict, type FileRecord } from '@/db/schema'
import { FileRepository, type FileFilters } from './repository'
import { extensionOf, INLINE_MIME_TYPES, resolveMime, sanitizeFilename } from './schema'

export interface ServeResult {
  download: Download
  headers: Record<string, string>
}

type Logger = { warn: (obj: object, msg: string) => void }

function megabytes(bytes: number): string {
  return String(Math.round((bytes / 1024 / 1024) * 10) / 10)
}

export class FileService {
  private readonly repo: FileRepository

  constructor(
    private readonly db: Db,
    private readonly storage: Storage,
    private readonly config: Pick<StorageConfig, 'uploadMaxSize' | 'uploadAllowedTypes'>,
    private readonly log: Logger = console,
  ) {
    this.repo = new FileRepository(db)
  }

  async upload(file: UploadedFile | null, uploaderId: number | null) {
    if (!file) throw new ServiceError('请选择要上传的文件', 400)
    if (file.data.length === 0) throw new ServiceError('文件内容为空', 400)
    if (file.data.length > this.config.uploadMaxSize) {
      throw new ServiceError(`文件过大，最大支持 ${megabytes(this.config.uploadMaxSize)}MB`, 413)
    }
    const name = sanitizeFilename(file.filename)
    const ext = extensionOf(name)
    if (!ext) throw new ServiceError('文件缺少扩展名，无法判断类型', 400)
    if (!this.config.uploadAllowedTypes.includes(ext)) throw new ServiceError(`不支持的文件类型：.${ext}`, 400)
    const mime = resolveMime(ext, await fileTypeFromBuffer(file.data))
    if (!mime) throw new ServiceError('文件内容与扩展名不符', 400)

    const sha256 = createHash('sha256').update(file.data).digest('hex')
    const driver = this.storage.current
    const objectKey = objectKeyFor(sha256)
    // Identical content already stored by this driver → reuse the object
    if (!(await this.repo.objectInUse(driver.name, objectKey)) || !(await driver.exists(objectKey))) {
      await driver.put(objectKey, file.data, mime)
    }
    const row = await this.repo.insert({
      storage: driver.name,
      bucket: driver.bucket,
      object_key: objectKey,
      original_name: name,
      mime_type: mime,
      size: file.data.length,
      sha256,
      uploader_id: uploaderId,
    })
    return fileToDict(row)
  }

  async list(page: number, perPage: number, filters: FileFilters) {
    const { total, items } = await this.repo.listPage(page, perPage, filters)
    return { items: items.map(fileToDict), total, page, per_page: perPage }
  }

  async getOr404(id: string): Promise<FileRecord> {
    const file = isUuid(id) ? await this.repo.getById(id.toLowerCase()) : null
    if (!file) throw notFound()
    return file
  }

  async info(file: FileRecord) {
    const refs = await this.repo.listRefs(file.id)
    return { ...fileToDict({ ...file, ref_count: refs.length }), references: refs }
  }

  /** How to serve a file: safe images inline (unless `download`), everything else as an attachment */
  async serve(file: FileRecord, download: boolean): Promise<ServeResult> {
    const inline = !download && INLINE_MIME_TYPES.has(file.mime_type)
    const result = await this.storage
      .get(file.storage)
      .download(file.object_key, { filename: file.original_name, contentType: file.mime_type, inline })
      .catch((err: unknown) => {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') throw new ServiceError('文件内容已丢失', 404)
        throw err
      })
    return {
      download: result,
      headers: {
        'Content-Type': file.mime_type,
        'Content-Length': String(file.size),
        'Content-Disposition': contentDisposition(file.original_name, inline),
        'X-Content-Type-Options': 'nosniff',
        // The content behind an id never changes
        'Cache-Control': 'private, max-age=86400',
        ETag: `"${file.sha256}"`,
      },
    }
  }

  async remove(file: FileRecord) {
    if ((await this.repo.countRefs(file.id)) > 0) throw new ServiceError('文件正在被使用，不能删除', 400)
    await this.repo.delete(file.id)
    await this.deleteObjectIfUnused(file)
    return { message: '删除成功' }
  }

  private async deleteObjectIfUnused(file: FileRecord) {
    if (await this.repo.objectInUse(file.storage, file.object_key)) return
    try {
      await this.storage.get(file.storage).delete(file.object_key)
    } catch (err) {
      // The row is gone either way; a leftover object only costs space
      this.log.warn({ err, key: file.object_key }, '删除文件对象失败')
    }
  }

  /**
   * Remove files that nothing references `hours` after upload. Runs under an advisory lock so only one process
   * cleans at a time; returns how many rows were removed (null when another process holds the lock).
   */
  async cleanupOrphans(hours = 24, limit = 500): Promise<number | null> {
    const removed = await this.db.transaction(async (tx) => {
      const repo = new FileRepository(tx)
      if (!(await repo.tryCleanupLock())) return null
      const orphans = await repo.listOrphans(hours, limit)
      return repo.deleteUnreferenced(orphans.map((f) => f.id))
    })
    if (removed === null) return null
    for (const file of removed) await this.deleteObjectIfUnused(file)
    return removed.length
  }
}
