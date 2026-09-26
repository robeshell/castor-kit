/**
 * Local driver: objects are files under STORAGE_LOCAL_DIR (a persistent volume in Docker Compose).
 * Writes go to a temp file first and are renamed into place, so readers never see a half-written object.
 */

import { randomBytes } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { assertObjectKey, type Download, type StorageDriver } from './types'

export class LocalStorage implements StorageDriver {
  readonly name = 'local' as const
  readonly bucket = null

  constructor(private readonly root: string) {}

  private pathOf(key: string): string {
    assertObjectKey(key)
    return join(this.root, key)
  }

  async put(key: string, data: Buffer): Promise<void> {
    const target = this.pathOf(key)
    await mkdir(dirname(target), { recursive: true })
    const temp = `${target}.${randomBytes(6).toString('hex')}.tmp`
    await writeFile(temp, data)
    await rename(temp, target)
  }

  async exists(key: string): Promise<boolean> {
    try {
      return (await stat(this.pathOf(key))).isFile()
    } catch {
      return false
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathOf(key), { force: true })
  }

  async download(key: string): Promise<Download> {
    const path = this.pathOf(key)
    await stat(path) // throws ENOENT before headers are sent
    return { kind: 'stream', stream: createReadStream(path) }
  }
}
