import { useTx } from '@/i18n'
import { cn } from '@/lib/utils'

/**
 * 卡片容器：白底 + 1px 发丝边 + 14px 圆角。页面里的分区一律用它（不要自己写阴影卡片）。
 *   <Panel title="系统状态" description="…" actions={…}>内容</Panel>
 *   <Panel padded={false}> 表格等需要贴边的内容 </Panel>
 */
export default function Panel({ title, description, actions, padded = true, className, bodyClassName, children, ...props }) {
  const tx = useTx()
  const hasHeader = title || description || actions
  return (
    <section className={cn('surface-card overflow-hidden', className)} {...props}>
      {hasHeader ? (
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0 space-y-0.5">
            {title ? <h3 className="text-sm font-medium">{tx(title)}</h3> : null}
            {description ? <p className="text-muted-foreground text-xs">{tx(description)}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn(padded && (hasHeader ? 'px-5 pb-5' : 'p-5'), bodyClassName)}>{children}</div>
    </section>
  )
}
