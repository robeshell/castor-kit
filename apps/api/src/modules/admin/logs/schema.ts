/**
 * Logs module schema layer
 */

import { formatDateTime } from '@/common/serialize'
import type { LoginLog, OperationLog } from '@/db/schema'

export const LOGIN_EXPORT_FIELD_MAP: Record<string, [string, (item: LoginLog) => unknown]> = {
  id: ['ID', (item) => item.id],
  username: ['用户名', (item) => item.username],
  status: ['状态', (item) => item.status],
  ip: ['IP 地址', (item) => item.ip || ''],
  user_agent: ['User-Agent', (item) => item.user_agent || ''],
  message: ['说明', (item) => item.message || ''],
  created_at: ['时间', (item) => formatDateTime(item.created_at)],
}

export const OPERATION_EXPORT_FIELD_MAP: Record<string, [string, (item: OperationLog) => unknown]> = {
  id: ['ID', (item) => item.id],
  username: ['用户名', (item) => item.username],
  module: ['模块', (item) => item.module],
  action: ['操作', (item) => item.action],
  method: ['方法', (item) => item.method],
  path: ['路径', (item) => item.path],
  target_id: ['目标ID', (item) => item.target_id || ''],
  status_code: ['状态码', (item) => (item.status_code !== null ? item.status_code : '')],
  ip: ['IP 地址', (item) => item.ip || ''],
  user_agent: ['User-Agent', (item) => item.user_agent || ''],
  payload: ['请求体', (item) => item.payload || ''],
  created_at: ['时间', (item) => formatDateTime(item.created_at)],
}

const METHOD_ACTIONS: Record<string, string> = { POST: 'create', PUT: 'update', DELETE: 'delete' }

export function resolveModuleAndAction(path: string, method: string): { module: string; action: string } {
  const segments = path.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)
  let module = 'system'
  let action = METHOD_ACTIONS[method] ?? method.toLowerCase()

  if (segments.length >= 3 && segments[0] === 'api' && segments[1] === 'admin') {
    module = segments[2]!
    if (segments.includes('import')) action = 'import'
    else if (segments.includes('export')) action = 'export'
    else if (segments.includes('logout')) {
      module = 'auth'
      action = 'logout'
    } else if (segments.includes('change-password')) {
      module = 'auth'
      action = 'change_password'
    }
  }
  return { module, action }
}
