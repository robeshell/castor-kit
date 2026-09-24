import { toast as sonnerToast } from 'sonner'

/**
 * 统一消息提示（sonner）。页面一律从这里引入：
 *   import { toast } from '@/lib/toast'
 *   toast.success('已保存')
 *   toast.apiError(err, '保存失败')   // 后端 {error} 文案优先，其次 fallback
 */
export const toast = Object.assign(
  (message, options) => sonnerToast(message, options),
  sonnerToast,
  {
    apiError(err, fallback = '操作失败，请稍后重试') {
      const message = (err && (err.error || err.message)) || fallback
      return sonnerToast.error(typeof message === 'string' ? message : fallback)
    },
  },
)

/** 从 request.js 抛出的错误对象里取后端文案 */
export function errorMessage(err, fallback = '操作失败，请稍后重试') {
  const message = err && (err.error || err.message)
  return typeof message === 'string' && message ? message : fallback
}
