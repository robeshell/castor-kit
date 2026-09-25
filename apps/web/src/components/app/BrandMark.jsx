import { cn } from '@/lib/utils'

/** Brand mark: gradient tile + wordmark */
export default function BrandMark({ className, showText = true, subtitle }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="bg-brand-gradient-strong shadow-brand flex size-7 shrink-0 items-center justify-center rounded-lg text-[13px] font-semibold text-white">
        C
      </div>
      {showText ? (
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-semibold tracking-tight">castor-kit</span>
          {subtitle ? <span className="text-muted-foreground truncate text-[11px]">{subtitle}</span> : null}
        </div>
      ) : null}
    </div>
  )
}
