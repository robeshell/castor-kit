/**
 * Webhooks module service layer: receivers, their secrets, delivery records, test events and redelivery
 */

import { randomBytes } from 'node:crypto'
import { notifySuperAdmins, type NotifyLogger } from '@/common/admin-notify'
import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { hostOfUrl, outboundHostReason } from '@/common/outbound'
import { openSecret, sealSecret } from '@/common/secret-box'
import { knownEvents, type EventBus } from '@/common/webhooks'
import type { AppConfig } from '@/config'
import type { Db } from '@/db/client'
import { webhookDeliveryToDict, webhookToDict, type Webhook } from '@/db/schema'
import { WebhookRepository, type DeliveryStatus } from './repository'
import type { WebhookInput } from './schema'

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

  /** The address's host must resolve to an allowed (not reserved / internal) address */
  private async checkHost(url: string) {
    const reason = await outboundHostReason(hostOfUrl(url), this.config.settingsAllowPrivateNetwork)
    if (reason) throw new ServiceError(reason, 400)
  }

  private notify(title: string, hook: { name: string; url: string }, actor: string) {
    return notifySuperAdmins(this.db, { title: `${actor} ${title}：${hook.name}`, content: `${actor} ${title}\n名称：${hook.name}\n地址：${hook.url}`, link: '/system/webhooks' }, this.log)
  }

  /** Create; the signing secret is returned with it (it can be viewed again later after confirming identity) */
  async create(values: WebhookInput, userId: number, actor: string) {
    await this.checkHost(values.url)
    const secret = newSecret()
    const row = await this.repo.insert({ ...values, secret: sealSecret(secret, this.config.secretKey), created_by: userId })
    await this.notify('新增了 Webhook', row, actor)
    return { item: webhookToDict(row), secret }
  }

  async update(hook: Webhook, changes: Partial<WebhookInput>, actor: string) {
    const values = { name: hook.name, url: hook.url, events: hook.events, is_active: hook.is_active, ...changes }
    await this.checkHost(values.url)
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
