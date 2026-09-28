import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Activity, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import StatCard from '@/shared/components/StatCard'

type Metric = 'requests' | 'errors' | 'success'

const METRICS: { key: Metric; label: string; value: number; icon: typeof Activity }[] = [
  { key: 'requests', label: '请求数', value: 48210, icon: Activity },
  { key: 'errors', label: '错误数', value: 37, icon: AlertTriangle },
  { key: 'success', label: '成功数', value: 48173, icon: CheckCircle2 },
]

export default function StatCardStates() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState<Metric>('requests')

  // Simulates a refresh: while loading the number and badge are skeletons (never 0, which looks like real data)
  const reload = () => {
    setLoading(true)
    setTimeout(() => setLoading(false), 1200)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs">{t('当前：{{name}}', { name: t(METRICS.find((m) => m.key === active)?.label ?? '') })}</span>
        <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
          {t('刷新')}
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {METRICS.map((m) => (
          // onClick makes the card a button; selected announces the chosen one, and className gives it a ring
          <StatCard
            key={m.key}
            label={m.label}
            value={m.value}
            icon={m.icon}
            loading={loading}
            onClick={() => setActive(m.key)}
            selected={active === m.key}
            className={cn(active === m.key && 'ring-primary/40 ring-2')}
          />
        ))}
      </div>
    </div>
  )
}
