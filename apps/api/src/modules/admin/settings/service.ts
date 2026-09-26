/**
 * System settings module service layer: read and save the registry in common/settings.ts, and try mail / storage /
 * AI settings before saving them ("test" buttons; drafts are applied on top of the saved values, nothing is written)
 */

import { createHash, randomBytes } from 'node:crypto'
import { ServiceError } from '@/common/errors'
import { createMailer, type MailLogger } from '@/common/mailer'
import { createOutboundAgent, hostOfUrl, outboundHostReason } from '@/common/outbound'
import {
  SETTING_DEFINITIONS,
  SettingValidationError,
  type SettingChanges,
  type Settings,
  type SettingsStore,
} from '@/common/settings'
import { objectKeyFor, Storage } from '@/common/storage'
import type { AppConfig } from '@/config'
import type { Db } from '@/db/client'
import { fetch } from 'undici'
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

  /**
   * SSRF protection: the SMTP host, S3 endpoint and AI API URL typed here must not point at reserved / internal
   * addresses (common/outbound.ts). `keys` limits the check to these settings; values pinned by the environment are
   * the operator's choice and skipped.
   */
  private async assertOutbound(settings: Settings, keys: Iterable<string>) {
    const hosts: Record<string, string> = {
      'mail.smtp_host': settings.mail.host,
      'storage.s3_endpoint': hostOfUrl(settings.storage.s3.endpoint),
      'ai.api_base': hostOfUrl(settings.ai.apiBase),
    }
    for (const key of keys) {
      const host = hosts[key]
      if (!host || this.store.isPinned(key)) continue
      const reason = await outboundHostReason(host, this.config.settingsAllowPrivateNetwork)
      if (reason) throw new ServiceError(reason, 400)
    }
  }

  /**
   * Tell every active super admin what changed, by whom (secrets: only that they changed). A hijacked admin account
   * pointing mail / storage / AI elsewhere is then visible to the others right away. Best effort: a failure here
   * doesn't undo the save.
   */
  private async notifyChange(changes: SettingChanges, actor: string) {
    const definitions = new Map(SETTING_DEFINITIONS.map((d) => [d.key, d]))
    const labels = Object.keys(changes).map((key) => definitions.get(key)?.label ?? key)
    const summary = labels.length > 3 ? `${labels.slice(0, 3).join('、')} 等 ${labels.length} 项` : labels.join('、')
    const lines = Object.entries(changes).map(([key, value]) => {
      const def = definitions.get(key)
      if (!def) return key
      if (def.type === 'secret') return `${def.label}：${value === null || value === '' ? '已清除' : '已更新'}`
      if (value === null) return `${def.label}：恢复默认`
      const text = Array.isArray(value) ? value.join(', ') : String(value)
      return `${def.label} → ${text.length > 80 ? `${text.slice(0, 77)}…` : text}`
    })
    try {
      await this.repo.notify(await this.repo.activeSuperAdminIds(), {
        // The bell shows only the title: say who changed what there
        title: `${actor} 修改了系统设置：${summary}`.slice(0, 200),
        content: `${actor} 修改了 ${lines.length} 项系统设置：\n${lines.join('\n')}`,
        link: '/system/settings',
      })
    } catch (err) {
      this.log.info({ err }, 'Settings change notification failed')
    }
  }

  /** Save the given { key: value } pairs (null resets a value); role codes in totp_required_roles must exist */
  async update(values: unknown, userId: number | null, actor = 'unknown') {
    if (values === undefined) throw new ServiceError('请提交要保存的设置', 400)
    const changes = this.changesOf(values)
    const required = changes['security.totp_required_roles']
    if (Array.isArray(required) && required.length > 0) {
      const codes = required.filter((c): c is string => typeof c === 'string')
      const found = await this.repo.existingRoleCodes(codes)
      const missing = codes.filter((c) => !found.has(c))
      if (missing.length > 0) throw new ServiceError(`角色编码不存在: ${missing.join(', ')}`, 400)
    }
    const { settings } = await this.guard(() => this.store.preview(changes))
    await this.assertOutbound(settings, Object.keys(changes))
    await this.guard(() => this.store.update(changes, userId))
    if (Object.keys(changes).length > 0) await this.notifyChange(changes, actor)
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
    await this.assertOutbound(settings, ['mail.smtp_host'])
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
    if (settings.storage.driver === 's3') await this.assertOutbound(settings, ['storage.s3_endpoint'])
    const storage = new Storage(settings.storage, this.config.storageLocalDir, { quick: true })
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
    const settings = await this.draft(values)
    const { ai } = settings
    await this.assertOutbound(settings, ['ai.api_base'])
    if (!ai.apiKey) throw new ServiceError('未配置 AI 模型，请在「系统设置 → AI」中填写 API Key', 400)
    let resp: Awaited<ReturnType<typeof fetch>>
    try {
      resp = await fetch(`${ai.apiBase}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ai.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: ai.model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 5 }),
        signal: AbortSignal.timeout(TEST_TIMEOUT_MS),
        // Re-check the address actually connected to (DNS rebinding)
        dispatcher: createOutboundAgent(this.config.settingsAllowPrivateNetwork || this.store.isPinned('ai.api_base'), TEST_TIMEOUT_MS),
      })
    } catch (err) {
      throw new ServiceError(`连接失败：${reasonOf(err)}`, 400)
    }
    if (!resp.ok) throw new ServiceError(`AI 接口返回 ${resp.status}，请检查地址、API Key 和模型名`, 400)
    return { message: 'AI 接口可用', model: ai.model }
  }
}
