import { cn } from '@/lib/utils'

const TONES = {
  neutral: 'bg-muted text-muted-foreground',
  brand: 'bg-brand-soft text-primary',
  info: 'bg-info-soft text-info',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
}
const DOTS = {
  neutral: 'bg-muted-foreground/60',
  brand: 'bg-primary',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

/**
 * 状态徽章。tone: neutral | brand | info | success | warning | danger
 *   <StatusBadge tone="success" dot>启用</StatusBadge>
 *   <StatusBadge tone="neutral" variant="plain" dot>草稿</StatusBadge>  // 只有圆点 + 文字
 */
export default function StatusBadge({ tone = 'neutral', dot = false, variant = 'soft', className, children }) {
  if (variant === 'plain') {
    return (
      <span className={cn('text-muted-foreground inline-flex items-center gap-1.5 text-xs', className)}>
        <span className={cn('size-1.5 rounded-full', DOTS[tone] || DOTS.neutral)} />
        {children}
      </span>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1.5 rounded-md px-1.5 text-xs font-medium whitespace-nowrap',
        TONES[tone] || TONES.neutral,
        className,
      )}
    >
      {dot ? <span className={cn('size-1.5 rounded-full', DOTS[tone] || DOTS.neutral)} /> : null}
      {children}
    </span>
  )
}
