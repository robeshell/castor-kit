/**
 * System settings module service layer: read and save the registry in common/settings.ts, and try mail / storage /
 * AI settings before saving them ("test" buttons; drafts are applied on top of the saved values, nothing is written)
 */

import { createHash, randomBytes } from 'node:crypto'
import { ServiceError } from '@/common/errors'
import { createMailer, type MailLogger } from '@/common/mailer'
import { SettingValidationError, type SettingChanges, type Settings, type SettingsStore } from '@/common/settings'
import { objectKeyFor, Storage } from '@/common/storage'
import type { AppConfig } from '@/config'
import type { Db } from '@/db/client'
import { SettingsRepository } from './repository'

const TEST_TIMEOUT_MS = 20_000
const EMAIL_RE = /^[^\s@]+@[^\s@]+$/

/** Short, single-line reason from an upstream error */
function reasonOf(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err)
  return text.split('\n')[0]!.slice(0, 200)
}

export class SettingsService {
  private readonly repo: SettingsRepository

  constructor(
    db: Db,
    private readonly store: SettingsStore,
    private readonly config: AppConfig,
    private readonly log: MailLogger,
  ) {
    this.repo = new SettingsRepository(db)
  }

  async list() {
    const [items, fileCounts] = await Promise.all([this.store.describe(), this.repo.fileCountsByStorage()])
    return { items, file_counts: fileCounts }
  }

  private changesOf(values: unknown): SettingChanges {
    if (values === undefined) return {}
    if (!values || typeof values !== 'object' || Array.isArray(values)) throw new ServiceError('请提交要保存的设置', 400)
    return values as SettingChanges
  }

  /** Validation errors of the store become 400s */
  private async guard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (err) {
      if (err instanceof SettingValidationError) throw new ServiceError(err.message, 400)
      throw err
    }
  }

  /** Save the given { key: value } pairs (null resets a value); role codes in totp_required_roles must exist */
  async update(values: unknown, userId: number | null) {
    if (values === undefined) throw new ServiceError('请提交要保存的设置', 400)
    const changes = this.changesOf(values)
    const required = changes['security.totp_required_roles']
    if (Array.isArray(required) && required.length > 0) {
      const codes = required.filter((c): c is string => typeof c === 'string')
      const found = await this.repo.existingRoleCodes(codes)
      const missing = codes.filter((c) => !found.has(c))
      if (missing.length > 0) throw new ServiceError(`角色编码不存在: ${missing.join(', ')}`, 400)
    }
    await this.guard(() => this.store.update(changes, userId))
    return this.list()
  }

  /** Settings as they would be with the draft applied */
  private draft(values: unknown): Promise<Settings> {
    return this.guard(async () => (await this.store.preview(this.changesOf(values))).settings)
  }

  /** Send a test mail with the (draft) mail settings */
  async testMail(values: unknown, to: unknown) {
    if (typeof to !== 'string' || !EMAIL_RE.test(to.trim())) throw new ServiceError('请输入正确的邮箱地址', 400)
    const settings = await this.draft(values)
    const mailer = createMailer(this.config, settings.mail, this.log)
    if (!mailer) throw new ServiceError('请先填写 SMTP 服务器', 400)
    try {
      await mailer.send({
        to: to.trim(),
        subject: 'castor-kit 测试邮件 / Test mail',
        text: '这是一封测试邮件，收到说明邮件设置可用。\n\nThis is a test mail: your mail settings work.',
      })
    } catch (err) {
      throw new ServiceError(`发送失败：${reasonOf(err)}`, 400)
    }
    return { message: '测试邮件已发送' }
  }

  /** Write, check and delete a small object with the (draft) storage settings */
  async testStorage(values: unknown) {
    const settings = await this.draft(values)
    const storage = new Storage(settings.storage, this.config.storageLocalDir)
    const data = randomBytes(32)
    const key = objectKeyFor(createHash('sha256').update(data).digest('hex'))
    try {
      await storage.current.put(key, data, 'application/octet-stream')
      if (!(await storage.current.exists(key))) throw new Error('object not found after upload')
      await storage.current.delete(key)
    } catch (err) {
      throw new ServiceError(`连接失败：${reasonOf(err)}`, 400)
    }
    return { message: '存储可用', driver: storage.current.name }
  }

  /** One tiny chat completion with the (draft) AI settings */
  async testAi(values: unknown) {
    const { ai } = await this.draft(values)
    if (!ai.apiKey) throw new ServiceError('未配置 AI 模型，请在「系统设置 → AI」中填写 API Key', 400)
    let resp: Response
    try {
      resp = await fetch(`${ai.apiBase}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ai.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: ai.model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 5 }),
        signal: AbortSignal.timeout(TEST_TIMEOUT_MS),
      })
    } catch (err) {
      throw new ServiceError(`连接失败：${reasonOf(err)}`, 400)
    }
    if (!resp.ok) throw new ServiceError(`AI 接口返回 ${resp.status}，请检查地址、API Key 和模型名`, 400)
    return { message: 'AI 接口可用', model: ai.model }
  }
}
