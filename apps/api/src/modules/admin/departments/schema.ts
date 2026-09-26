/**
 * Departments module schema layer
 */

import { z } from 'zod'

/** Request body: loose + all optional; normalization happens in the service */
export const departmentBodySchema = z.record(z.string(), z.unknown()).nullish()

export const DEPT_STATUSES = ['active', 'disabled'] as const
export type DeptStatus = (typeof DEPT_STATUSES)[number]

export function isDeptStatus(value: unknown): value is DeptStatus {
  return typeof value === 'string' && (DEPT_STATUSES as readonly string[]).includes(value)
}
