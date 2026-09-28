/**
 * Dev tools service: the WebSocket message of the performance monitor. The metrics themselves come from
 * common/system-stats.ts (shared with the dashboard's system status).
 */

import type { SystemSnapshot } from '@/common/system-stats'

/** The WebSocket message for a snapshot */
export function metricMessage(snapshot: SystemSnapshot): string {
  return JSON.stringify({ ...snapshot, type: 'metric' })
}
