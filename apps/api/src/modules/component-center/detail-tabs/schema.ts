/**
 * Detail tabs page schema layer: request body
 */

import { z } from 'zod'
import { field } from '@/common/validation'

export const MEMBER_STATUSES = ['active', 'leave', 'probation'] as const

export const memberBody = z.object({
  name: field.requiredText('姓名', '姓名不能为空'),
  department: field.text('部门'),
  role_title: field.text('职位'),
  email: field.text('邮箱'),
  phone: field.text('电话'),
  status: field.choice('状态', MEMBER_STATUSES, 'active'),
  join_date: field.date('入职日期'),
  avatar_color: field.text('头像颜色'),
  bio: field.text('简介'),
  sort_order: field.int('排序', 0),
  is_active: field.bool('启用', true),
})

export type MemberInput = z.output<typeof memberBody>
