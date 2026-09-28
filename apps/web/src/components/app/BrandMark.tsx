import type { ReactNode } from 'react'
import { APP_NAME } from '@/lib/brand'
import { cn } from '@/lib/utils'
import logoUrl from '@/assets/castor-logo.png'

/**
 * Brand mark: logo + wordmark (the app name, lib/brand.ts). castor-kit's own wordmark is "castor" in bold Geist (tight
 * tracking) + "kit" in the brand gradient, so it follows the accent color; another name is set in the same type.
 * A project with its own logo replaces the image imported below.
 * The text sits in the last child div: the collapsed sidebar hides it with [&>div:last-child]:hidden.
 */
export interface BrandMarkProps {
  className?: string
  imageClassName?: string
  /** Show the wordmark next to the avatar (default true); without it the image gets the brand name as its alt text */
  showText?: boolean
  /** Small line under the wordmark */
  subtitle?: ReactNode
}

export default function BrandMark({ className, imageClassName, showText = true, subtitle }: BrandMarkProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <img
        src={logoUrl}
        alt={showText ? '' : APP_NAME}
        width={32}
        height={32}
        className={cn('size-8 shrink-0 object-contain', imageClassName)}
      />
      {showText ? (
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[21px] leading-none font-bold tracking-[-0.04em]">
            {APP_NAME === 'castor-kit' ? (
              <>
                castor<span className="text-brand-gradient">kit</span>
              </>
            ) : (
              APP_NAME
            )}
          </span>
          {subtitle ? <span className="text-muted-foreground mt-1 truncate text-[11px]">{subtitle}</span> : null}
        </div>
      ) : null}
    </div>
  )
}
