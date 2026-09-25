// 本地改动：底色用 foreground 低透明度（亮暗通用、看得清），用一道横向扫光代替整块闪烁（animate-pulse），
// 并延迟 200ms 淡入（加载很快时根本不出现，避免闪一下）。
// 重新 `shadcn add skeleton` 会覆盖，需手动保留。
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
