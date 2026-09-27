/**
 * Components → Feedback: StatusBadge, EmptyState, ConfirmAction, toast (lib/toast) and the Skeleton loading pattern.
 * Layout and conventions follow the data table page (examples imported twice, props in ./props.ts).
 */
import ConfirmActions from '@/modules/component_center/pages/components/feedback_page/examples/ConfirmActions'
import confirmActionsSource from '@/modules/component_center/pages/components/feedback_page/examples/ConfirmActions.tsx?raw'
import EmptyStates from '@/modules/component_center/pages/components/feedback_page/examples/EmptyStates'
import emptyStatesSource from '@/modules/component_center/pages/components/feedback_page/examples/EmptyStates.tsx?raw'
import SkeletonLoading from '@/modules/component_center/pages/components/feedback_page/examples/SkeletonLoading'
import skeletonLoadingSource from '@/modules/component_center/pages/components/feedback_page/examples/SkeletonLoading.tsx?raw'
import StatusBadgeTones from '@/modules/component_center/pages/components/feedback_page/examples/StatusBadgeTones'
import statusBadgeTonesSource from '@/modules/component_center/pages/components/feedback_page/examples/StatusBadgeTones.tsx?raw'
import StatusMapping from '@/modules/component_center/pages/components/feedback_page/examples/StatusMapping'
import statusMappingSource from '@/modules/component_center/pages/components/feedback_page/examples/StatusMapping.tsx?raw'
import ToastMessages from '@/modules/component_center/pages/components/feedback_page/examples/ToastMessages'
import toastMessagesSource from '@/modules/component_center/pages/components/feedback_page/examples/ToastMessages.tsx?raw'
import {
  CONFIRM_ACTION_PROPS,
  EMPTY_STATE_PROPS,
  SKELETON_PROPS,
  STATUS_BADGE_PROPS,
  TOAST_PROPS,
} from '@/modules/component_center/pages/components/feedback_page/props'
import Example from '@/modules/component_center/showcase/Example'
import PropsTable from '@/modules/component_center/showcase/PropsTable'
import ShowcasePage, { ShowcaseSection } from '@/modules/component_center/showcase/ShowcasePage'

const IMPORTS = `import StatusBadge, { type StatusTone } from '@/shared/components/StatusBadge'
import EmptyState from '@/shared/components/EmptyState'
import ConfirmAction from '@/shared/components/ConfirmAction'
import { errorMessage, toast } from '@/lib/toast'
import { Skeleton } from '@/components/ui/skeleton'`

export default function FeedbackPage() {
  return (
    <ShowcasePage
      title="反馈"
      intro="告诉用户发生了什么：StatusBadge 标出记录状态，EmptyState 说明为什么是空的、下一步做什么，ConfirmAction 在危险操作前确认，toast 反馈操作结果，Skeleton 给加载中的内容占位。不要用 alert / window.confirm。toast 的字符串消息会自动翻译，description 等选项和 toast.promise 的文字不会，要自己用 t()。"
      imports={IMPORTS}
    >
      <ShowcaseSection title="示例">
        <Example title="状态标签" description="六种语义色，每种有浅色底、带圆点和 plain 三种样式；文字写中文原文，由组件翻译。" source={statusBadgeTonesSource}>
          <StatusBadgeTones />
        </Example>
        <Example title="状态映射" description="用 Record<Status, { label, tone }> 把接口的状态值映射成文字和颜色，漏写一个状态就编译不过；次要的是 / 否状态用 plain。" source={statusMappingSource}>
          <StatusMapping />
        </Example>
        <Example title="空状态" description="默认样式；还没有数据时说明原因并给出下一步；搜索无结果时提供清除搜索。" source={emptyStatesSource}>
          <EmptyStates />
        </Example>
        <Example title="确认操作" description="onConfirm 返回 Promise 时确认按钮显示加载；失败时先 toast.apiError 再抛出，确认框保持打开；不危险的操作设 destructive={false}。" source={confirmActionsSource}>
          <ConfirmActions />
        </Example>
        <Example title="消息提示" description="四种类型加普通消息；带变量的文字先用 t()；apiError 优先显示接口返回的错误；toast.promise 跟随异步操作的结果。" source={toastMessagesSource}>
          <ToastMessages />
        </Example>
        <Example title="骨架屏" description="加载时按真实内容的形状放 Skeleton，数据到了原位替换；Skeleton 200ms 后才淡入，快的请求不会闪一下。" source={skeletonLoadingSource}>
          <SkeletonLoading />
        </Example>
      </ShowcaseSection>
      <ShowcaseSection title="属性">
        <PropsTable title="StatusBadge" items={STATUS_BADGE_PROPS} />
        <PropsTable title="EmptyState" items={EMPTY_STATE_PROPS} />
        <PropsTable title="ConfirmAction" items={CONFIRM_ACTION_PROPS} />
        <PropsTable title="toast" items={TOAST_PROPS} />
        <PropsTable title="Skeleton" items={SKELETON_PROPS} />
      </ShowcaseSection>
    </ShowcasePage>
  )
}
