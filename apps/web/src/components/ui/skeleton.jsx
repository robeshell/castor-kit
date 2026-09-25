// Local change: the base color uses a low-opacity foreground (works in light and dark, stays legible), and a horizontal shimmer sweep replaces the whole-block flashing (animate-pulse),
// and it fades in after a 200ms delay (doesn't appear at all when loading is fast, avoiding a flash).
// Re-running `shadcn add skeleton` will overwrite this; preserve it manually.
import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "relative animate-skeleton-in overflow-hidden rounded-md bg-foreground/[0.06] dark:bg-foreground/[0.08]",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-gradient-to-r after:from-transparent after:via-foreground/[0.05] after:to-transparent dark:after:via-foreground/[0.07]",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
