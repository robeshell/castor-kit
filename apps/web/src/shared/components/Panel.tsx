import type { ComponentProps, ReactNode } from 'react'
import { useTx } from '@/i18n'
import { cn } from '@/lib/utils'

/**
 * Card container: white background + 1px hairline border + 14px radius. Use it for every section in a page (don't hand-roll shadowed cards).
 *   <Panel title="系统状态" description="…" actions={…}>…</Panel>
 *   <Panel padded={false}> content that needs to sit flush, like tables </Panel>
 */
export interface PanelProps extends Omit<ComponentProps<'section'>, 'title'> {
  /** Chinese source text (translated here) or a node */
  title?: ReactNode
  description?: ReactNode
  /** Controls on the right of the header */
  actions?: ReactNode
  /** Pad the body (default true); false for flush content such as tables */
  padded?: boolean
  bodyClassName?: string
}

export default function Panel({ title, description, actions, padded = true, className, bodyClassName, children, ...props }: PanelProps) {
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
