/**
 * Traffic flow routes
 *
 * Read-only mock data: source → page visits jitter by up to ±5% per request; each page's visits are then split into
 * outcomes by fixed shares (so every page's inflow equals its outflow), and the funnel follows the total visits.
 * This module has no model/repository/service, only routes + constant data.
 */

import { randomInt } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { FUNNEL_SHARES, OUTCOME_SHARES, SOURCE_LINKS, type OutcomeId, type PageId } from './schema'

/** A value moved by a random amount within ±5% */
function jitter(value: number): number {
  return Math.round(value * (1 + randomInt(-50, 51) / 1000))
}

export function trafficFlowData() {
  const sourceLinks = SOURCE_LINKS.map((l) => ({ ...l, value: jitter(l.value) }))
  const inflow = new Map<PageId, number>()
  for (const l of sourceLinks) inflow.set(l.target, (inflow.get(l.target) ?? 0) + l.value)

  const outcomeLinks = [...inflow].flatMap(([page, visits]) => {
    const shares = Object.entries(OUTCOME_SHARES[page]) as [OutcomeId, number][]
    const values = shares.map(([, share]) => Math.round(visits * share))
    // Rounding remainder goes to the last outcome, so a page's outflow equals its inflow exactly
    values[values.length - 1]! += visits - values.reduce((a, v) => a + v, 0)
    return shares.map(([outcome], i) => ({ source: page, target: outcome, value: values[i]! }))
  })

  const visits = sourceLinks.reduce((a, l) => a + l.value, 0)
  const funnel = FUNNEL_SHARES.map((s) => ({ stage: s.stage, value: Math.round(visits * s.share) }))
  return { links: [...sourceLinks, ...outcomeLinks], funnel }
}

export async function registerTrafficFlowRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/admin/component-center/dataviz/traffic-flow/data', { preHandler: loginRequired }, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'cc_dataviz_traffic_flow'))) {
      return reply.status(403).send({ error: '无权限' })
    }
    return trafficFlowData()
  })
}
