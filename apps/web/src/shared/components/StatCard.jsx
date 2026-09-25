import { useEffect, useId } from 'react'
import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** 数字滚动（尊重 reduced motion 由全局 CSS 处理动画，这里用 motion 的数值插值） */
export function CountUp({ value = 0, decimals = 0, className }) {
  const mv = useMotionValue(0)
  const text = useTransform(mv, (v) =>
    Number(v).toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
  )
  useEffect(() => {
    const controls = animate(mv, Number(value) || 0, { duration: 0.9, ease: [0.2, 0.8, 0.2, 1] })
    return () => controls.stop()
  }, [mv, value])
  return <motion.span className={cn('tabular-nums', className)}>{text}</motion.span>
}

/** 迷你趋势线（渐变面积） */
export function Sparkline({ points = [], width = 96, height = 32, className }) {
  const id = useId().replace(/:/g, '')
  // 有效点不足 2 个时画出来只是一条平线 + 末尾尖刺，不如不画
  if (points.filter((p) => Number(p) > 0).length < 2) return null
  const max = Math.max(...points)
  const min = Math.min(...points)
  const span = max - min || 1
  const step = width / (points.length - 1)
  const coords = points.map((p, i) => [i * step, height - 3 - ((p - min) / span) * (height - 6)])
  const line = coords.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" className={className}>
      <defs>
        <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--brand-from)" stopOpacity="0.28" />
          <stop offset="1" stopColor="var(--brand-from)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`line-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--brand-from)" />
          <stop offset="1" stopColor="var(--brand-to)" />
        </linearGradient>
      </defs>
      <path d={`${line} L${width} ${height} L0 ${height} Z`} fill={`url(#area-${id})`} />
      <motion.path
        d={line}
        stroke={`url(#line-${id})`}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
      />
    </svg>
  )
}

/**
 * 指标卡：标签 + 大数字（滚动）+ 变化徽章 + 迷你趋势
 *   <StatCard label="注册用户" value={128} suffix="人" delta="+12%" trend={[…]} hint="较上周 +3" icon={Users} />
 * trend 只在数据真有走势时传；否则用 hint 放一句说明文字。
 * loading 为 true 时数字与徽章位置显示骨架（不要用 0 占位，看起来像真实数据是 0）。
 */
export default function StatCard({ label, value, suffix, decimals = 0, delta, deltaTone = 'success', trend, hint, icon: Icon, loading = false, className, onClick }) {
  const toneClass = deltaTone === 'danger' ? 'bg-danger-soft text-danger' : deltaTone === 'neutral' ? 'bg-muted text-muted-foreground' : 'bg-success-soft text-success'
  return (
    <div
      onClick={onClick}
      className={cn(
        'surface-card group flex flex-col gap-3 p-4 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_var(--border),0_12px_28px_-16px_rgba(15,23,42,0.25)]',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground flex items-center gap-2 text-[13px]">
          {Icon ? <Icon className="size-3.5" /> : null}
          {label}
        </span>
        {delta && !loading ? <span className={cn('rounded-full px-1.5 py-0.5 text-[11px] font-medium', toneClass)}>{delta}</span> : null}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-1">
          {loading ? (
            <Skeleton className="h-[26px] w-20" />
          ) : (
            <>
              <CountUp value={value} decimals={decimals} className="text-[26px] leading-none font-semibold tracking-tight" />
              {suffix ? <span className="text-muted-foreground text-xs">{suffix}</span> : null}
            </>
          )}
        </div>
        {trend ? <Sparkline points={trend} /> : null}
      </div>
      {hint ? <div className="text-muted-foreground -mt-1 truncate text-xs">{hint}</div> : null}
    </div>
  )
}
