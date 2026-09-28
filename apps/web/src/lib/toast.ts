import { toast as sonnerToast, type ExternalToast } from 'sonner'
import i18n from '@/i18n'

/** A toast message: text (translated when it's a string), a node, or a function returning a node */
export type ToastMessage = Parameters<typeof sonnerToast>[0]

/** The `{ error }` body of a failed API call as request.ts rejects it, or any Error */
type ErrorLike = { error?: unknown; message?: unknown }

/**
 * Unified toast messages (sonner). Pages always import from here:
 *   import { toast } from '@/lib/toast'
 *   toast.success('已保存')
 *   toast.apiError(err, '保存失败')   // backend {error} message first, then the fallback
 *
 * String messages are auto-translated to the current language (the Chinese source text is the key, see src/i18n); build parameterized messages with t() in the page before passing them.
 * Backend errors are already translated according to the Accept-Language request header; if no translation is found here, it's shown as is.
 * Errors stay until dismissed (a timed-out error is easily missed, and it tells the user what to do next).
 */
function tr(message: string): string
function tr(message: ToastMessage): ToastMessage
function tr(message: ToastMessage): ToastMessage {
  return typeof message === 'string' ? i18n.t(message) : message
}

/** Generic fallback when the server sent no message */
const DEFAULT_FALLBACK = '操作没有完成，请重试；如果一直失败，请联系管理员。'
/** Next step shown under a caller's short fallback ("save failed") */
const NEXT_STEP = '请重试；如果一直失败，请联系管理员。'

/** Error toasts don't time out; pass `duration` to override */
const STICKY: ExternalToast = { duration: Infinity }

/** err.error || err.message, for whatever was thrown */
const rawMessage = (err: unknown): unknown => {
  if (!err || typeof err !== 'object') return undefined
  const { error, message }: ErrorLike = err
  return error || message
}

export const toast = Object.assign(
  (message: ToastMessage, options?: ExternalToast) => sonnerToast(tr(message), options),
  sonnerToast,
  {
    success: (message: ToastMessage, options?: ExternalToast) => sonnerToast.success(tr(message), options),
    error: (message: ToastMessage, options?: ExternalToast) => sonnerToast.error(tr(message), { ...STICKY, ...options }),
    warning: (message: ToastMessage, options?: ExternalToast) => sonnerToast.warning(tr(message), options),
    info: (message: ToastMessage, options?: ExternalToast) => sonnerToast.info(tr(message), options),
    apiError(err: unknown, fallback = DEFAULT_FALLBACK): string | number {
      const message = rawMessage(err)
      if (typeof message === 'string' && message) return sonnerToast.error(tr(message), STICKY)
      // No message from the server: the caller's fallback names what failed, the description says what to do
      return sonnerToast.error(tr(fallback), { ...STICKY, description: fallback === DEFAULT_FALLBACK ? undefined : tr(NEXT_STEP) })
    },
  },
)

/** Extract the backend message from the error object thrown by request.ts */
export function errorMessage(err: unknown, fallback = DEFAULT_FALLBACK): string {
  const message = rawMessage(err)
  return tr(typeof message === 'string' && message ? message : fallback)
}
