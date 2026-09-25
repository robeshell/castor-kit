import { toast as sonnerToast } from 'sonner'
import i18n from '@/i18n'

/**
 * Unified toast messages (sonner). Pages always import from here:
 *   import { toast } from '@/lib/toast'
 *   toast.success('已保存')
 *   toast.apiError(err, '保存失败')   // backend {error} message first, then the fallback
 *
 * String messages are auto-translated to the current language (the Chinese source text is the key, see src/i18n); build parameterized messages with t() in the page before passing them.
 * Backend errors are already translated according to the Accept-Language request header; if no translation is found here, it's shown as is.
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

/** Extract the backend message from the error object thrown by request.js */
export function errorMessage(err, fallback = '操作失败，请稍后重试') {
  const message = err && (err.error || err.message)
  return tr(typeof message === 'string' && message ? message : fallback)
}
