import { cn } from '@/lib/utils'
import logoUrl from '@/assets/castor-logo.png'

/** Brand mark: beaver avatar + wordmark */
export default function BrandMark({ className, imageClassName, showText = true, subtitle }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <img
        src={logoUrl}
        alt={showText ? '' : 'castor-kit'}
        width={28}
        height={28}
        className={cn('size-7 shrink-0 object-contain', imageClassName)}
      />
      {showText ? (
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-semibold tracking-tight">castor-kit</span>
          {subtitle ? <span className="text-muted-foreground truncate text-[11px]">{subtitle}</span> : null}
        </div>
      ) : null}
    </div>
  )
}
