import { useId } from 'react'
import { motion } from 'motion/react'
import { layoutSpring } from '@/lib/motion'
import { useTx } from '@/i18n'
import { cn } from '@/lib/utils'

/**
 * Segmented tabs with a sliding underline (status filters, view switching). The gradient underline moves smoothly via layoutId.
 *   <SegmentedTabs value={tab} onChange={setTab} items={[{ value: 'all', label: '全部', count: 12 }, …]} />
 * variant="pill": gray pill style (for small toggles like 24h / 7d / 30d).
 */
export default function SegmentedTabs({ value, onChange, items = [], variant = 'underline', className }) {
  const tx = useTx()
  const id = useId()
  if (variant === 'pill') {
    return (
      <div className={cn('bg-muted inline-flex rounded-lg p-0.5 text-xs', className)}>
        {items.map((item) => {
          const active = item.value === value
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange?.(item.value)}
              className={cn(
                'relative rounded-md px-2.5 py-1 transition-colors',
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {active ? (
                <motion.span
                  layoutId={`${id}-pill`}
                  transition={layoutSpring}
                  className="bg-background absolute inset-0 rounded-md shadow-[0_1px_2px_rgba(0,0,0,0.08),0_0_0_1px_var(--border)]"
                />
              ) : null}
              <span className="relative">{tx(item.label)}</span>
            </button>
          )
        })}
      </div>
    )
  }
  return (
    <div className={cn('flex items-center gap-5 border-b', className)}>
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange?.(item.value)}
            className={cn(
              'relative flex h-9 items-center gap-1.5 text-[13px] transition-colors',
              active ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tx(item.label)}
            {item.count !== undefined ? (
              <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-[11px] font-normal tabular-nums">
                {item.count}
              </span>
            ) : null}
            {active ? (
              <motion.span
                layoutId={`${id}-underline`}
                transition={layoutSpring}
                className="bg-brand-gradient absolute right-0 -bottom-px left-0 h-0.5 rounded-full"
              />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
