/**
 * Warn every active super admin about a security-relevant change (system settings, webhooks): a hijacked admin
 * account repointing mail, storage, AI or webhooks is then visible to the others right away. One personal
 * notification per super admin; failures are logged, never thrown.
 */

import { and, eq } from 'drizzle-orm'
import type { Executor } from '@/db/client'
import { admin_users, notifications, roles, user_roles } from '@/db/schema'

export interface NotifyLogger {
  info(obj: object, msg: string): void
}

export async function notifySuperAdmins(
  db: Executor,
  message: { title: string; content: string; link: string },
  log: NotifyLogger,
): Promise<void> {
  try {
    const rows = await db
      .selectDistinct({ id: admin_users.id })
      .from(admin_users)
      .innerJoin(user_roles, eq(user_roles.user_id, admin_users.id))
      .innerJoin(roles, eq(roles.id, user_roles.role_id))
      .where(and(eq(roles.code, 'super_admin'), eq(admin_users.status, 'active')))
    if (rows.length === 0) return
    await db.insert(notifications).values(
      rows.map((r) => ({ title: message.title.slice(0, 200), content: message.content, link: message.link, noti_type: 'warning', is_global: false, user_id: r.id })),
    )
  } catch (err) {
    log.info({ err }, 'Super admin notification failed')
  }
}
