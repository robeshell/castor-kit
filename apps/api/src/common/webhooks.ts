/**
 * Webhooks: domain events (user.created, role.updated, <module>.deleted …) pushed to receivers configured under
 * System → Configuration → Webhook.
 *
 * - Modules declare their events once (declareEvents) so the page can offer them; services call
 *   `events.emit(name, data)` after their transaction committed. Emitting never fails the caller: problems are logged
 * - emit() writes one delivery row per matching active webhook, then tries them right away in the background
 * - Every attempt claims its row atomically (pending → delivering), so the web process and the scheduler worker never
 *   send the same delivery twice; failures retry after 1 min, 5 min, 30 min, 2 h, 6 h, then the delivery is failed.
 *   Retries run in the scheduler loop (webhookDeliveryJob)
 * - Requests: POST JSON `{ id, event, created_at, data }`, 10 s timeout, redirects not followed, signed with the
 *   webhook's secret: `X-Castor-Signature: sha256=HMAC-SHA256(secret, "<timestamp>.<body>")` plus
 *   `X-Castor-Timestamp`, `X-Castor-Event` and `X-Castor-Delivery` (the event id, for de-duplication)
 * - The target address is checked like other outbound settings (common/outbound.ts), again at connect time
 */

import { createHmac, randomUUID } from 'node:crypto'
import { and, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import { request } from 'undici'
import { createOutboundAgent } from '@/common/outbound'
import { openSecret } from '@/common/secret-box'
import { utcNowIso } from '@/common/serialize'
import type { AppConfig } from '@/config'
import type { Executor } from '@/db/client'
import { webhook_deliveries, webhooks, type WebhookDelivery } from '@/db/schema'
import { utcNow } from '@/db/schema/columns'

// ---- Event names ----

const registry = new Map<string, string>()

/** Register event names with a short description (shown when choosing events for a webhook) */
export function declareEvents(events: Record<string, string>): void {
  for (const [name, label] of Object.entries(events)) registry.set(name, label)
}

export function knownEvents(): Array<{ event: string; label: string }> {
  return [...registry].map(([event, label]) => ({ event, label })).sort((a, b) => a.event.localeCompare(b.event))
}

/** A webhook's subscriptions: exact names, "*" (everything) or prefixes like "user.*" */
export function matchesEvent(patterns: string[], event: string): boolean {
  return patterns.some((p) => p === '*' || p === event || (p.endsWith('.*') && event.startsWith(p.slice(0, -1))))
}

/** Valid subscription: "*", a known event, or "<prefix>.*" matching at least one known event */
export function isValidSubscription(pattern: string): boolean {
  if (pattern === '*' || registry.has(pattern)) return true
  return pattern.endsWith('.*') && [...registry.keys()].some((e) => matchesEvent([pattern], e))
}

declareEvents({ ping: '测试事件（「发送测试」按钮）' })

// ---- Delivery ----

/** Seconds to wait before retry n (after attempt n failed); after the last one the delivery is failed */
export const RETRY_DELAYS = [60, 300, 1800, 7200, 21600]
export const MAX_ATTEMPTS = RETRY_DELAYS.length + 1
const TIMEOUT_MS = 10_000
const MAX_RESPONSE_CHARS = 2000
/** A delivery stuck in 'delivering' this long (process crashed mid-send) is retried */
const STALE_CLAIM_MINUTES = 5

export interface WebhookLogger {
  warn(obj: object, msg: string): void
}

export function signatureOf(secret: string, timestamp: string, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`
}

export class WebhookDispatcher {
  constructor(
    private readonly db: Executor,
    private readonly config: Pick<AppConfig, 'secretKey' | 'settingsAllowPrivateNetwork'>,
    private readonly log: WebhookLogger,
  ) {}

  /**
   * Claim due deliveries (all due ones, or just `ids`) and send them. Returns how many were attempted.
   * The claim is a single UPDATE … RETURNING over rows locked with SKIP LOCKED, so concurrent callers split the work.
   */
  async deliver(ids?: number[], limit = 50): Promise<WebhookDelivery[]> {
    const due = and(
      or(
        and(eq(webhook_deliveries.status, 'pending'), or(isNull(webhook_deliveries.next_retry_at), lte(webhook_deliveries.next_retry_at, utcNow()))),
        and(
          eq(webhook_deliveries.status, 'delivering'),
          lte(webhook_deliveries.updated_at, sql`${utcNow()} - make_interval(mins => ${STALE_CLAIM_MINUTES})`),
        ),
      ),
      ids ? inArray(webhook_deliveries.id, ids) : undefined,
    )
    const claimed = await this.db
      .update(webhook_deliveries)
      .set({ status: 'delivering', attempts: sql`${webhook_deliveries.attempts} + 1`, updated_at: sql`${utcNow()}` })
      .where(
        inArray(
          webhook_deliveries.id,
          sql`(select ${webhook_deliveries.id} from ${webhook_deliveries} where ${due} order by ${webhook_deliveries.id} limit ${limit} for update skip locked)`,
        ),
      )
      .returning()
    const done: WebhookDelivery[] = []
    for (const row of claimed) done.push(await this.send(row))
    return done
  }

  private async send(row: WebhookDelivery): Promise<WebhookDelivery> {
    const [hook] = await this.db.select().from(webhooks).where(eq(webhooks.id, row.webhook_id)).limit(1)
    const secret = hook ? openSecret(hook.secret, this.config.secretKey) : null
    let code: number | null = null
    let text: string
    let ok = false
    if (!hook || !hook.is_active || !secret) {
      text = !hook || !hook.is_active ? 'Webhook 已停用' : '密钥无法解密（SECRET_KEY 变了？请重新生成密钥）'
    } else {
      const body = JSON.stringify(row.payload)
      const timestamp = String(Math.floor(Date.now() / 1000))
      const agent = createOutboundAgent(this.config.settingsAllowPrivateNetwork, TIMEOUT_MS)
      try {
        const res = await request(hook.url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'user-agent': 'castor-kit-webhook',
            'x-castor-event': row.event,
            'x-castor-delivery': row.event_id,
            'x-castor-timestamp': timestamp,
            'x-castor-signature': signatureOf(secret, timestamp, body),
          },
          body,
          dispatcher: agent,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })
        code = res.statusCode
        text = (await res.body.text()).slice(0, MAX_RESPONSE_CHARS)
        // Redirects aren't followed: a 3xx counts as a failure
        ok = code >= 200 && code < 300
      } catch (err) {
        text = (err instanceof Error ? err.message : String(err)).slice(0, MAX_RESPONSE_CHARS)
      } finally {
        await agent.close().catch(() => undefined)
      }
    }
    const retryIn = ok || !hook?.is_active ? null : RETRY_DELAYS[row.attempts - 1]
    const status = ok ? 'success' : retryIn === undefined || retryIn === null ? 'failed' : 'pending'
    const [updated] = await this.db
      .update(webhook_deliveries)
      .set({
        status,
        response_code: code,
        response_body: text,
        next_retry_at: status === 'pending' ? sql`${utcNow()} + make_interval(secs => ${retryIn})` : null,
        delivered_at: ok ? sql`${utcNow()}` : null,
        updated_at: sql`${utcNow()}`,
      })
      .where(eq(webhook_deliveries.id, row.id))
      .returning()
    if (!ok) this.log.warn({ webhookId: row.webhook_id, deliveryId: row.id, code, attempts: row.attempts }, 'Webhook delivery failed')
    return updated!
  }
}

/** What services call after a successful write */
export class EventBus {
  private readonly dispatcher: WebhookDispatcher

  constructor(
    private readonly db: Executor,
    config: Pick<AppConfig, 'secretKey' | 'settingsAllowPrivateNetwork'>,
    private readonly log: WebhookLogger,
  ) {
    this.dispatcher = new WebhookDispatcher(db, config, log)
  }

  /**
   * Queue `event` for every active webhook subscribed to it and try them right away (in the background).
   * Resolves once the deliveries are stored; never throws.
   */
  async emit(event: string, data: unknown): Promise<void> {
    try {
      const hooks = (await this.db.select().from(webhooks).where(eq(webhooks.is_active, true))).filter((h) => matchesEvent(h.events, event))
      if (hooks.length === 0) return
      const eventId = randomUUID()
      const payload = { id: eventId, event, created_at: utcNowIso(), data }
      const rows = await this.db
        .insert(webhook_deliveries)
        .values(hooks.map((h) => ({ webhook_id: h.id, event_id: eventId, event, payload })))
        .returning({ id: webhook_deliveries.id })
      const ids = rows.map((r) => r.id)
      setImmediate(() => {
        this.dispatcher.deliver(ids).catch((err) => this.log.warn({ err, event }, 'Webhook delivery failed'))
      })
    } catch (err) {
      this.log.warn({ err, event }, 'Queueing webhook deliveries failed')
    }
  }

  /** Send one event to one webhook now (the "send test" button, redelivery) and wait for the outcome */
  async sendNow(webhookId: number, event: string, data: unknown, eventId: string = randomUUID()): Promise<WebhookDelivery> {
    const payload = { id: eventId, event, created_at: utcNowIso(), data }
    const [row] = await this.db
      .insert(webhook_deliveries)
      .values({ webhook_id: webhookId, event_id: eventId, event, payload })
      .returning({ id: webhook_deliveries.id })
    const [done] = await this.dispatcher.deliver([row!.id])
    return done!
  }

  /** Send a past delivery again: same event id and payload (receivers de-duplicate on X-Castor-Delivery) */
  async resend(delivery: WebhookDelivery): Promise<WebhookDelivery> {
    const [row] = await this.db
      .insert(webhook_deliveries)
      .values({ webhook_id: delivery.webhook_id, event_id: delivery.event_id, event: delivery.event, payload: delivery.payload })
      .returning({ id: webhook_deliveries.id })
    const [done] = await this.dispatcher.deliver([row!.id])
    return done!
  }

  /** Retry due deliveries (scheduler loop) */
  deliverDue(): Promise<WebhookDelivery[]> {
    return this.dispatcher.deliver()
  }
}
