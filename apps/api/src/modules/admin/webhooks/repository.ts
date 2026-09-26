/**
 * Webhooks module data access
 */

import { and, count, desc, eq, sql } from 'drizzle-orm'
import type { Executor } from '@/db/client'
import { webhook_deliveries, webhooks } from '@/db/schema'
import { utcNow } from '@/db/schema/columns'

export type DeliveryStatus = 'pending' | 'delivering' | 'success' | 'failed'

export class WebhookRepository {
  constructor(private readonly db: Executor) {}

  async list() {
    return this.db.select().from(webhooks).orderBy(desc(webhooks.id))
  }

  /** Latest delivery status per webhook, and failures in the last 24 hours */
  async deliveryStats(): Promise<Map<number, { last_status: string | null; last_at: string | null; failed_24h: number }>> {
    const rows = await this.db.execute<{ webhook_id: number; last_status: string | null; last_at: string | null; failed_24h: string }>(sql`
      select w.id as webhook_id,
        (select d.status from ${webhook_deliveries} d where d.webhook_id = w.id order by d.id desc limit 1) as last_status,
        (select d.created_at from ${webhook_deliveries} d where d.webhook_id = w.id order by d.id desc limit 1) as last_at,
        (select count(*) from ${webhook_deliveries} d
          where d.webhook_id = w.id and d.status = 'failed' and d.created_at > ${utcNow()} - interval '24 hours') as failed_24h
      from ${webhooks} w`)
    return new Map(rows.rows.map((r) => [r.webhook_id, { last_status: r.last_status, last_at: r.last_at, failed_24h: Number(r.failed_24h) }]))
  }

  async getById(id: number) {
    const [row] = await this.db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1)
    return row ?? null
  }

  async insert(values: typeof webhooks.$inferInsert) {
    const [row] = await this.db.insert(webhooks).values(values).returning()
    return row!
  }

  async update(id: number, values: Partial<typeof webhooks.$inferInsert>) {
    const [row] = await this.db
      .update(webhooks)
      .set({ ...values, updated_at: sql`${utcNow()}` })
      .where(eq(webhooks.id, id))
      .returning()
    return row ?? null
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(webhooks).where(eq(webhooks.id, id))
  }

  async listDeliveries(webhookId: number, page: number, perPage: number, status: DeliveryStatus | '') {
    const where = and(eq(webhook_deliveries.webhook_id, webhookId), status ? eq(webhook_deliveries.status, status) : undefined)
    const [totalRow] = await this.db.select({ n: count() }).from(webhook_deliveries).where(where)
    const items = await this.db
      .select()
      .from(webhook_deliveries)
      .where(where)
      .orderBy(desc(webhook_deliveries.id))
      .limit(perPage)
      .offset((page - 1) * perPage)
    return { total: Number(totalRow?.n ?? 0), items }
  }

  async getDelivery(id: number) {
    const [row] = await this.db.select().from(webhook_deliveries).where(eq(webhook_deliveries.id, id)).limit(1)
    return row ?? null
  }
}
