/**
 * Visual modeler repository: the menus and dictionaries a spec can refer to
 */

import { and, asc, eq, isNull } from 'drizzle-orm'
import type { Executor } from '@/db/client'
import { dict_types, menus } from '@/db/schema'

export class ModelerRepository {
  constructor(private readonly db: Executor) {}

  /** Directory menus (no page of their own): where a generated module's menu can go */
  listDirectories() {
    return this.db
      .select({ id: menus.id, name: menus.name, code: menus.code, parent_id: menus.parent_id })
      .from(menus)
      .where(and(eq(menus.menu_type, 'menu'), isNull(menus.component)))
      .orderBy(asc(menus.sort_order), asc(menus.id))
  }

  /** Active dictionaries, for dict fields */
  listDictionaries() {
    return this.db
      .select({ code: dict_types.code, name: dict_types.name })
      .from(dict_types)
      .where(eq(dict_types.is_active, true))
      .orderBy(asc(dict_types.sort_order), asc(dict_types.id))
  }
}
