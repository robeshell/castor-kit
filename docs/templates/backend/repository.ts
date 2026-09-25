/**
 * repository layer template → apps/api/src/modules/<domain>/<resource>/repository.ts
 *
 * TODO: replace <Resource> with the type name (PascalCase), <resource> with the resource name (snake_case)
 *
 * Responsibility: pure database reads/writes (Drizzle queries). No business logic, no HTTP.
 * The constructor takes an Executor: either a plain connection or a transaction (when a transaction is needed, the service passes tx in via db.transaction).
 */

import { count, desc, eq, ilike, inArray, type SQL } from 'drizzle-orm'
import type { Executor } from '@/db/client'
import { <resource>s, type <Resource>, type New<Resource> } from '@/db/schema'
import type { <Resource>Values } from './schema'

export class <Resource>Repository {
  constructor(private readonly db: Executor) {}

  private searchWhere(search: string): SQL | undefined {
    return search ? ilike(<resource>s.name, `%${search}%`) : undefined
  }

  async listPage(page: number, perPage: number, search: string) {
    const where = this.searchWhere(search)
    const [totalRow] = await this.db.select({ n: count() }).from(<resource>s).where(where)
    const items = await this.db
      .select()
      .from(<resource>s)
      .where(where)
      .orderBy(desc(<resource>s.id))
      .limit(perPage)
      .offset((page - 1) * perPage)
    return { total: totalRow?.n ?? 0, items }
  }

  /** Export: exports everything when ids is null; ordered by id descending */
  async listForExport(ids: number[] | null): Promise<<Resource>[]> {
    return this.db
      .select()
      .from(<resource>s)
      .where(ids ? inArray(<resource>s.id, ids) : undefined)
      .orderBy(desc(<resource>s.id))
  }

  async getById(id: number): Promise<<Resource> | null> {
    const [row] = await this.db.select().from(<resource>s).where(eq(<resource>s.id, id)).limit(1)
    return row ?? null
  }

  async insert(values: New<Resource>): Promise<<Resource>> {
    const [row] = await this.db.insert(<resource>s).values(values).returning()
    return row!
  }

  async update(id: number, values: <Resource>Values): Promise<<Resource> | null> {
    const [row] = await this.db.update(<resource>s).set(values).where(eq(<resource>s.id, id)).returning()
    return row ?? null
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(<resource>s).where(eq(<resource>s.id, id))
  }
}
