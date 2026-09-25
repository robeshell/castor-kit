import { toast as sonnerToast } from 'sonner'
import i18n from '@/i18n'

/**
 * 统一消息提示（sonner）。页面一律从这里引入：
 *   import { toast } from '@/lib/toast'
 *   toast.success('已保存')
 *   toast.apiError(err, '保存失败')   // 后端 {error} 文案优先，其次 fallback
 *
 * 字符串消息会按当前语言自动翻译（中文原文即 key，见 src/i18n）；带参数的消息在页面里用 t() 拼好再传。
 * 后端返回的报错已按请求头 Accept-Language 翻译过，这里查不到译文会原样显示。
 */
const tr = (message) => (typeof message === 'string' ? i18n.t(message) : message)

export const toast = Object.assign(
  (message, options) => sonnerToast(tr(message), options),
  sonnerToast,
  {
    success: (message, options) => sonnerToast.success(tr(message), options),
    error: (message, options) => sonnerToast.error(tr(message), options),
    warning: (message, options) => sonnerToast.warning(tr(message), options),
    info: (message, options) => sonnerToast.info(tr(message), options),
    apiError(err, fallback = '操作失败，请稍后重试') {
      const message = (err && (err.error || err.message)) || fallback
      return sonnerToast.error(tr(typeof message === 'string' ? message : fallback))
    },
  },
)

/** 从 request.js 抛出的错误对象里取后端文案 */
export function errorMessage(err, fallback = '操作失败，请稍后重试') {
  const message = err && (err.error || err.message)
  return tr(typeof message === 'string' && message ? message : fallback)
}
