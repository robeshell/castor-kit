/**
 * Storage drivers for the file center. New uploads go to the driver chosen in system settings; existing files are
 * always read back through the driver recorded on their row, so switching drivers doesn't strand older files (as long
 * as the old driver is still configured).
 */

import type { Settings, SettingsStore } from '@/common/settings'
import { LocalStorage } from './local'
import { S3Storage } from './s3'
import type { StorageDriver, StorageName } from './types'

export * from './types'

export class Storage {
  readonly current: StorageDriver
  private readonly drivers = new Map<StorageName, StorageDriver>()

  /** `quick`: see S3Storage (used by the settings page's connection test) */
  constructor(settings: Settings['storage'], localDir: string, options: { quick?: boolean } = {}) {
    this.drivers.set('local', new LocalStorage(localDir))
    const { s3 } = settings
    if (s3.bucket && s3.accessKey && s3.secretKey) this.drivers.set('s3', new S3Storage(s3, options))
    // s3 chosen but not complete (settings validation prevents this; a pinned environment might not): uploads fail
    this.current = this.drivers.get(settings.driver) ?? new UnconfiguredStorage(settings.driver)
  }

  /** Driver for a stored file; throws when that driver is no longer configured */
  get(name: string): StorageDriver {
    const driver = this.drivers.get(name as StorageName)
    if (!driver) throw new Error(`storage driver "${name}" is not configured`)
    return driver
  }
}

/** Stand-in for a selected driver that can't be built; every operation fails */
export class UnconfiguredStorage implements StorageDriver {
  readonly bucket = null
  constructor(readonly name: StorageName) {}
  private async fail(): Promise<never> {
    throw new Error(`storage driver "${this.name}" is not configured`)
  }
  put = () => this.fail()
  exists = () => this.fail()
  delete = () => this.fail()
  download = () => this.fail()
}

/**
 * The Storage for the current settings, rebuilt when they change (the S3 client is reused otherwise). Both the web
 * process and the scheduler worker use this, so they agree on where files live.
 */
export class StorageProvider {
  private cached: { key: string; storage: Storage } | null = null

  constructor(
    private readonly settings: Pick<SettingsStore, 'get'>,
    private readonly localDir: string,
  ) {}

  async get(): Promise<Storage> {
    const current = (await this.settings.get()).storage
    const key = JSON.stringify(current)
    if (this.cached?.key !== key) this.cached = { key, storage: new Storage(current, this.localDir) }
    return this.cached.storage
  }
}
