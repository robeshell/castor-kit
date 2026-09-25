/**
 * Public demo guard (DEMO_MODE).
 *
 * Everything outside the component gallery is read-only: accounts, roles, menus, dictionaries, scheduled tasks,
 * announcements and password changes all reject writes, so visitors can't lock others out or break the demo.
 * The gallery stays fully editable and is restored by src/demo/reset.ts.
 */

import type { FastifyInstance } from 'fastify'
import type { AppConfig } from '@/config'
import { requestPath } from '@/common/csrf'

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** Write endpoints that stay open in the demo */
export const DEMO_WRITABLE: RegExp[] = [
  /^\/api\/admin\/(login|logout)$/,
  /^\/api\/admin\/component-center\//,
  /^\/api\/admin\/notifications\/(\d+\/read|read-all)$/,
]

export function isDemoWritable(path: string): boolean {
  return DEMO_WRITABLE.some((re) => re.test(path))
}

export function registerDemoGuard(app: FastifyInstance, config: Pick<AppConfig, 'demoMode'>): void {
  if (!config.demoMode) return
  app.addHook('onRequest', async (request, reply) => {
    if (READ_METHODS.has(request.method)) return
    const path = requestPath(request)
    if (!path.startsWith('/api/') || isDemoWritable(path)) return
    return reply.status(403).send({ error: '演示环境不允许此操作' })
  })
}
