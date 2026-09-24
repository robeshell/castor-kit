/**
 * 地图热力图路由（对齐 AuraStack backend/app/component_center/api/map_heatmap.py）
 *
 * 只读模拟数据：各省基准值 + randint(-200, 200) 抖动，外加 randint(1, 100) 的 seed。
 * 原模块只有 api 层（无 model/crud/service），这里同样只放 routes + 常量数据。
 */

import { randomInt } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { PROVINCE_DATA } from './schema'

/** Python `random.randint(a, b)`（闭区间） */
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
