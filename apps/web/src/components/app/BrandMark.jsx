import { cn } from '@/lib/utils'
import logoUrl from '@/assets/castor-logo.png'

/**
 * Brand mark: beaver avatar + wordmark.
 * Wordmark = "castor" in bold Geist (tight tracking) + "kit" in the brand gradient, so it follows the accent color.
 * The text sits in the last child div: the collapsed sidebar hides it with [&>div:last-child]:hidden.
 */
export default function BrandMark({ className, imageClassName, showText = true, subtitle }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <img
        src={logoUrl}
        alt={showText ? '' : 'castor-kit'}
        width={32}
        height={32}
        className={cn('size-8 shrink-0 object-contain', imageClassName)}
      />
      {showText ? (
        <div className="flex min-w-0 flex-col">
          <span aria-label="castor-kit" className="truncate text-[21px] leading-none font-bold tracking-[-0.04em]">
            castor<span className="text-brand-gradient">kit</span>
          </span>
          {subtitle ? <span className="text-muted-foreground mt-1 truncate text-[11px]">{subtitle}</span> : null}
        </div>
      ) : null}
    </div>
  )
}
