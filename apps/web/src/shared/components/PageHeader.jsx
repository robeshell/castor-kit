import { useTx } from '@/i18n'
import { cn } from '@/lib/utils'

/**
 * Page header: title + description + actions on the right. Every page uses it at the top.
 *   <PageHeader title="用户管理" actions={<Button>{t('新建')}</Button>} />
 * description holds only informative content (e.g. "4 columns · 8 cards"), not an introduction to the page's features.
 * Fixed 24px gap (mb-6) to the content below; pages must not pass mb-* to override it:
 * Tailwind v4's space-y-* sets spacing via zero-specificity :where(), so className="mb-0" wipes it out entirely and the card below ends up flush against it.
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
