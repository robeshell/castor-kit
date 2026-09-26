/**
 * Storage drivers for the file center. New uploads go to the configured driver; existing files are always read back
 * through the driver recorded on their row, so switching STORAGE_DRIVER doesn't strand older files (as long as the old
 * driver is still configured).
 */

import type { StorageConfig } from '@/config'
import { LocalStorage } from './local'
import { S3Storage } from './s3'
import type { StorageDriver, StorageName } from './types'

export * from './types'

export class Storage {
  readonly current: StorageDriver
  private readonly drivers = new Map<StorageName, StorageDriver>()

  constructor(config: StorageConfig) {
    this.drivers.set('local', new LocalStorage(config.localDir))
    if (config.s3.bucket && config.s3.accessKey && config.s3.secretKey) this.drivers.set('s3', new S3Storage(config.s3))
    this.current = this.drivers.get(config.driver)!
  }

  /** Driver for a stored file; throws when that driver is no longer configured */
  get(name: string): StorageDriver {
    const driver = this.drivers.get(name as StorageName)
    if (!driver) throw new Error(`storage driver "${name}" is not configured`)
    return driver
  }
}
