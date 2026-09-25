import { useTx } from '@/i18n'
import { cn } from '@/lib/utils'

/**
 * 页面标题区：标题 + 描述 + 右侧操作。每个页面顶部统一用它。
 *   <PageHeader title="用户管理" actions={<Button>新建</Button>} />
 * description 只放有信息量的内容（如「4 列 · 8 张卡片」），不要写页面功能介绍。
 * 与下方内容固定间距 24px（mb-6），页面不要再传 mb-* 覆盖：
 * Tailwind v4 的 space-y-* 用零优先级的 :where() 设置间距，className="mb-0" 会把它整个压掉，导致下方卡片贴边。
 */
export default function PageHeader({ title, description, actions, className, children }) {
  const tx = useTx()
  return (
    <div className={cn('mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0 space-y-1">
        <h1 className="text-[22px] leading-tight font-semibold tracking-tight md:text-2xl">{tx(title)}</h1>
        {description ? <p className="text-muted-foreground text-[13px]">{tx(description)}</p> : null}
        {children}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
