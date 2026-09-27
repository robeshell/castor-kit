import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { CountUp, Sparkline } from '@/shared/components/StatCard'

const SERIES = [
  [12, 18, 15, 22, 19, 27, 31, 28, 35],
  [40, 36, 38, 30, 33, 26, 24, 27, 21],
  [20, 24, 22, 25, 23, 26, 24, 27, 25],
]

export default function CountUpAndSparkline() {
  const { t } = useTranslation()
  const [total, setTotal] = useState(12840)
  const [series, setSeries] = useState(0)

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="space-y-2">
        <div className="text-muted-foreground text-xs">CountUp</div>
        {/* Rolls from the old value to the new one whenever value changes */}
        <div className="flex items-baseline gap-3">
          <CountUp value={total} className="text-3xl font-semibold tracking-tight" />
          <CountUp value={total / 1000} decimals={2} className="text-muted-foreground text-sm" />
        </div>
        <Button variant="outline" size="sm" onClick={() => setTotal((v) => v + Math.round(Math.random() * 5000))}>
          {t('增加')}
        </Button>
      </div>
      <div className="space-y-2">
        <div className="text-muted-foreground text-xs">Sparkline</div>
        {/* Colors follow the accent; width / height in pixels. Fewer than 2 positive points draws nothing */}
        <div className="flex items-end gap-4">
          <Sparkline points={SERIES[series]} />
          <Sparkline points={SERIES[series]} width={180} height={48} />
        </div>
        <Button variant="outline" size="sm" onClick={() => setSeries((i) => (i + 1) % SERIES.length)}>
          {t('换一组数据')}
        </Button>
      </div>
    </div>
  )
}
