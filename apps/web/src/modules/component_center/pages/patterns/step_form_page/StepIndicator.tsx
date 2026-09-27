import { Check } from 'lucide-react'
import { motion } from 'motion/react'
import { useTx } from '@/i18n'
import { EASE_OUT } from '@/lib/motion'
import { cn } from '@/lib/utils'

export interface StepIndicatorStep {
  /** Chinese source text (translated here) */
  title: string
  description: string
}

export interface StepIndicatorProps {
  steps: readonly StepIndicatorStep[]
  /** Index of the current step */
  current: number
}

/** Horizontal step indicator: done (check) / current (outlined) / upcoming (muted); connectors fill as steps complete */
export default function StepIndicator({ steps, current }: StepIndicatorProps) {
  const tx = useTx()
  return (
    <ol className="flex items-start">
      {steps.map((s, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={s.title} aria-current={active ? 'step' : undefined} className={cn('flex min-w-0 items-start', i < steps.length - 1 && 'flex-1')}>
            <div className="flex min-w-0 items-start gap-2.5">
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums transition-colors duration-200',
                  done && 'bg-primary text-primary-foreground',
                  active && 'bg-brand-soft text-primary ring-primary ring-1',
                  !done && !active && 'bg-muted text-muted-foreground',
                )}
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <div className={cn('truncate text-[13px] leading-5 font-medium', !done && !active && 'text-muted-foreground')}>{tx(s.title)}</div>
                <div className="text-muted-foreground hidden truncate text-xs sm:block">{tx(s.description)}</div>
              </div>
            </div>
            {i < steps.length - 1 ? (
              <div className="bg-border relative mx-3 mt-3 h-px min-w-4 flex-1 overflow-hidden">
                <motion.div
                  className="bg-primary absolute inset-y-0 left-0"
                  initial={false}
                  animate={{ width: done ? '100%' : '0%' }}
                  transition={{ duration: 0.25, ease: EASE_OUT }}
                />
              </div>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
