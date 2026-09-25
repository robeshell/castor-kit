/**
 * Map heatmap routes
 *
 * Read-only mock data: per-province base value + randint(-200, 200) jitter, plus a randint(1, 100) seed.
 * This module has no model/repository/service, only routes + constant data.
 */

import { randomInt } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { PROVINCE_DATA } from './schema'

/** Random integer in the closed interval [a, b] */
function randint(a: number, b: number): number {
  return randomInt(a, b + 1)
}

export async function registerMapHeatmapRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/admin/component-center/dataviz/map-heatmap/data', { preHandler: loginRequired }, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_dataviz_map_heatmap'))) {
      return reply.status(403).send({ error: '无权限' })
    }
    const seed = randint(1, 100)
    const data = PROVINCE_DATA.map((p) => ({
      name: p.name,
      value: p.value + randint(-200, 200),
      lat: p.lat,
      lng: p.lng,
    }))
    return { data, seed }
  })
}
