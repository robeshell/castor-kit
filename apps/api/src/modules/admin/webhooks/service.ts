/**
 * Webhooks module service layer: receivers, their secrets, delivery records, test events and redelivery
 */

import { randomBytes } from 'node:crypto'
import { notifySuperAdmins, type NotifyLogger } from '@/common/admin-notify'
import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { hostOfUrl, outboundHostReason } from '@/common/outbound'
import { openSecret, sealSecret } from '@/common/secret-box'
import { isValidSubscription, knownEvents, type EventBus } from '@/common/webhooks'
import type { AppConfig } from '@/config'
import type { Db } from '@/db/client'
import { webhookDeliveryToDict, webhookToDict, type Webhook } from '@/db/schema'
import { WebhookRepository, type DeliveryStatus } from './repository'

type Data = Record<string, unknown>

const newSecret = () => `whsec_${randomBytes(24).toString('base64url')}`

export class WebhookService {
  private readonly repo: WebhookRepository

  constructor(
    private readonly db: Db,
    private readonly config: Pick<AppConfig, 'secretKey' | 'settingsAllowPrivateNetwork'>,
    private readonly events: EventBus,
    private readonly log: NotifyLogger,
  ) {
    this.repo = new WebhookRepository(db)
  }

  async list() {
    const [items, stats] = await Promise.all([this.repo.list(), this.repo.deliveryStats()])
    return {
      items: items.map((w) => ({ ...webhookToDict(w), ...(stats.get(w.id) ?? { last_status: null, last_at: null, failed_24h: 0 }) })),
    }
  }

  /** Event names a webhook can subscribe to */
  eventOptions() {
    return { items: knownEvents() }
  }

  async getOr404(id: number): Promise<Webhook> {
    const row = await this.repo.getById(id)
    if (!row) throw notFound()
    return row
  }

  /** Normalized name / url / events / is_active; url must be http(s) and not reserved / internal */
  private async validate(data: Data, current?: Webhook) {
    const name = typeof data.name === 'string' ? data.name.trim() : (current?.name ?? '')
    if (!name || name.length > 100) throw new ServiceError('请填写名称（最多 100 个字符）', 400)
    const url = typeof data.url === 'string' ? data.url.trim() : (current?.url ?? '')
    if (!/^https?:\/\/[^\s/]+/i.test(url) || url.length > 500 || !hostOfUrl(url)) throw new ServiceError('请填写正确的地址（http:// 或 https://）', 400)
    const reason = await outboundHostReason(hostOfUrl(url), this.config.settingsAllowPrivateNetwork)
    if (reason) throw new ServiceError(reason, 400)
    const events = Array.isArray(data.events)
      ? [...new Set(data.events.filter((e): e is string => typeof e === 'string').map((e) => e.trim()))]
      : (current?.events ?? [])
    if (events.length === 0) throw new ServiceError('请至少订阅一个事件', 400)
    const unknown = events.filter((e) => !isValidSubscription(e))
    if (unknown.length > 0) throw new ServiceError(`未知的事件：${unknown.join(', ')}`, 400)
    const isActive = typeof data.is_active === 'boolean' ? data.is_active : (current?.is_active ?? true)
    return { name, url, events, is_active: isActive }
  }

  private notify(title: string, hook: { name: string; url: string }, actor: string) {
    return notifySuperAdmins(this.db, { title: `${actor} ${title}：${hook.name}`, content: `${actor} ${title}\n名称：${hook.name}\n地址：${hook.url}`, link: '/system/webhooks' }, this.log)
  }

  /** Create; the signing secret is returned with it (it can be viewed again later after confirming identity) */
  async create(data: Data, userId: number, actor: string) {
    const values = await this.validate(data)
    const secret = newSecret()
    const row = await this.repo.insert({ ...values, secret: sealSecret(secret, this.config.secretKey), created_by: userId })
    await this.notify('新增了 Webhook', row, actor)
    return { item: webhookToDict(row), secret }
  }

  async update(hook: Webhook, data: Data, actor: string) {
    const values = await this.validate(data, hook)
    const row = (await this.repo.update(hook.id, values))!
    if (values.url !== hook.url) await this.notify('修改了 Webhook 地址', row, actor)
    return webhookToDict(row)
  }

  async remove(hook: Webhook) {
    await this.repo.delete(hook.id)
    return { message: '删除成功' }
  }

  secret(hook: Webhook) {
    const secret = openSecret(hook.secret, this.config.secretKey)
    if (!secret) throw new ServiceError('密钥无法解密，请重新生成', 400)
    return { secret }
  }

  async rotateSecret(hook: Webhook) {
    const secret = newSecret()
    await this.repo.update(hook.id, { secret: sealSecret(secret, this.config.secretKey) })
    return { secret }
  }

  /** Send a `ping` event now and report the outcome */
  async test(hook: Webhook) {
    const delivery = await this.events.sendNow(hook.id, 'ping', { message: 'castor-kit webhook test', webhook: { id: hook.id, name: hook.name } })
    return webhookDeliveryToDict(delivery)
  }

  async deliveries(hook: Webhook, page: number, perPage: number, status: DeliveryStatus | '') {
    const { total, items } = await this.repo.listDeliveries(hook.id, page, perPage, status)
    return { items: items.map(webhookDeliveryToDict), total, page, per_page: perPage }
  }

  /** Send a past delivery again (same event id and payload) */
  async redeliver(deliveryId: number) {
    const delivery = await this.repo.getDelivery(deliveryId)
    if (!delivery) throw notFound()
    return webhookDeliveryToDict(await this.events.resend(delivery))
  }
}
