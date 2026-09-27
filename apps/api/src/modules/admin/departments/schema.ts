/**
 * Departments module schema layer: request bodies
 */

import { z } from 'zod'
import { field, invalidMessage, required } from '@/common/validation'

export const DEPT_STATUSES = ['active', 'disabled'] as const
export type DeptStatus = (typeof DEPT_STATUSES)[number]

export function isDeptStatus(value: unknown): value is DeptStatus {
  return typeof value === 'string' && (DEPT_STATUSES as readonly string[]).includes(value)
}

const SORT_ORDER_MESSAGE = '排序必须是非负整数'
const DIRECTION_MESSAGE = 'direction 参数必须是 up 或 down'

/** Create / update body; the database checks (unique code, parent / leader exist, no cycle) are in the service */
export const departmentBody = z.object({
  name: field.requiredText('部门名称', '部门名称不能为空').refine((v) => v.length <= 100, { error: '部门名称不能超过 100 个字符' }),
  code: field.requiredText('部门编码', '部门编码不能为空').refine((v) => v.length <= 50, { error: '部门编码不能超过 50 个字符' }),
  parent_id: field.id('上级部门'),
  leader_id: field.id('负责人'),
  sort_order: z
    .number({ error: invalidMessage('排序') })
    .int({ error: SORT_ORDER_MESSAGE })
    .min(0, { error: SORT_ORDER_MESSAGE })
    .nullish()
    .transform((v) => v ?? 0),
  // Missing → active on create, kept on edit; null / '' are rejected (they would otherwise re-enable a disabled department)
  status: z.enum(DEPT_STATUSES, { error: '状态取值不合法' }).default('active'),
})

export type DepartmentInput = z.output<typeof departmentBody>

/** Move a department one place up or down among its siblings */
export const departmentSortBody = z.object({
  direction: required(field.optionalChoice('direction', ['up', 'down'], DIRECTION_MESSAGE), DIRECTION_MESSAGE),
})
