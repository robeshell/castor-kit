import type { PropDoc } from '@/modules/component_center/showcase/PropsTable'

/** StatusBadge (StatusBadgeProps in shared/components/StatusBadge.tsx) */
export const STATUS_BADGE_PROPS: readonly PropDoc[] = [
  { name: 'tone', type: "'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'danger'", default: "'neutral'", description: '语义色：草稿 / 停用用 neutral，进行中 info，成功 success，待处理 warning，失败 danger' },
  { name: 'dot', type: 'boolean', default: 'false', description: '文字前加圆点（plain 样式总是带圆点）' },
  { name: 'variant', type: "'soft' | 'plain'", default: "'soft'", description: 'soft：浅色底的标签；plain：只有圆点和灰色文字' },
  { name: 'children', type: 'ReactNode', description: '文字（中文原文，组件内翻译）' },
  { name: 'className', type: 'string', description: '追加的 class' },
]

/** EmptyState (EmptyStateProps in shared/components/EmptyState.tsx) */
export const EMPTY_STATE_PROPS: readonly PropDoc[] = [
  { name: 'icon', type: 'ComponentType<{ className?: string }>', default: 'Inbox', description: '图标组件（lucide 图标）' },
  // i18n-ignore-next-line: the default value shown as code
  { name: 'title', type: 'ReactNode', default: "'暂无数据'", description: '标题（中文原文，组件内翻译）' },
  { name: 'description', type: 'ReactNode', description: '说明为什么是空的、下一步做什么（中文原文，组件内翻译）' },
  { name: 'action', type: 'ReactNode', description: '文字下方的按钮' },
  { name: 'className', type: 'string', description: '追加的 class，例如调整上下留白' },
]

/** ConfirmAction (ConfirmActionProps in shared/components/ConfirmAction.tsx) */
export const CONFIRM_ACTION_PROPS: readonly PropDoc[] = [
  { name: 'children', type: 'ReactNode', description: '触发按钮（单个元素，本身不要再写 onClick）' },
  // i18n-ignore-next-line: the default value shown as code
  { name: 'title', type: 'ReactNode', default: "'确认执行该操作？'", description: '确认框标题（中文原文，组件内翻译）' },
  { name: 'description', type: 'ReactNode', description: '后果说明，例如「删除后不可恢复。」' },
  // i18n-ignore-next-line: the default value shown as code
  { name: 'confirmText', type: 'ReactNode', default: "'确认'", description: '确认按钮文字' },
  // i18n-ignore-next-line: the default value shown as code
  { name: 'cancelText', type: 'ReactNode', default: "'取消'", description: '取消按钮文字' },
  { name: 'destructive', type: 'boolean', default: 'true', description: '红色确认按钮；不危险的操作设为 false' },
  { name: 'onConfirm', type: '() => void | Promise<unknown>', description: '确认后调用；返回 Promise 时按钮显示加载，失败（reject）时确认框保持打开' },
  { name: 'disabled', type: 'boolean', default: 'false', description: '只渲染触发按钮，不弹确认框' },
]

/** The toast helpers in lib/toast.ts */
export const TOAST_PROPS: readonly PropDoc[] = [
  { name: 'toast.success / error / warning / info', type: '(message, options?) => id', description: '字符串消息自动翻译；带变量的文字先用 t() 拼好' },
  { name: 'toast', type: '(message, options?) => id', description: '没有图标的普通消息' },
  // i18n-ignore-next-line: the default value shown as code
  { name: 'toast.apiError', type: '(err, fallback?) => id', default: "'操作失败，请稍后重试'", description: '显示接口返回的 { error }，没有时显示兜底文案' },
  { name: 'toast.promise', type: '(promise, { loading, success, error })', description: 'sonner 原样透出：文字不会自动翻译，需要自己用 t()' },
  { name: 'errorMessage', type: '(err, fallback?) => string', description: '取出接口错误文字（已翻译），用于页面内显示错误' },
  { name: 'options', type: 'ExternalToast', description: 'sonner 选项（description、duration、action 等），不会自动翻译' },
]

/** Skeleton (components/ui/skeleton.tsx): a div that fades in after 200ms, with a shimmer */
export const SKELETON_PROPS: readonly PropDoc[] = [
  { name: 'className', type: 'string', description: '尺寸和形状，照着真实内容写，例如 h-4 w-32、size-9 rounded-full' },
  { name: '...props', type: "ComponentProps<'div'>", description: '其他 div 属性' },
]
