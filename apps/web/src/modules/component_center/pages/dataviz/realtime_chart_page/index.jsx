import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { Pause, Play, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { chartBase, hexToRgba, useChartColors } from '@/lib/chart-theme'
import { cn } from '@/lib/utils'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'
import StatusBadge from '@/shared/components/StatusBadge'
import { useIsMobile } from '@/shared/hooks/useIsMobile'

const MAX_POINTS = 60
const SERIES_CONFIG = [
  { key: 'temperature', name: '温度', unit: '°C', min: 20, max: 35, colorVar: 'chart-1', accent: 'bg-chart-1' },
  { key: 'humidity', name: '湿度', unit: '%', min: 40, max: 90, colorVar: 'chart-2', accent: 'bg-chart-2' },
  { key: 'pressure', name: '压力', unit: 'kPa', min: 100, max: 110, colorVar: 'chart-4', accent: 'bg-chart-4' },
  { key: 'flow', name: '流量', unit: 'm³/h', min: 50, max: 200, colorVar: 'chart-5', accent: 'bg-chart-5' },
]
const SPEED_MS = { '0.5x': 2000, '1x': 1000, '2x': 500 }
const SPEED_OPTIONS = [
  { label: '0.5× 慢速', value: '0.5x' },
  { label: '1× 正常', value: '1x' },
  { label: '2× 快速', value: '2x' },
]

function randomValue(min, max, prev) {
  const delta = (max - min) * 0.05
  const next = prev + (Math.random() - 0.5) * 2 * delta
  return Math.max(min, Math.min(max, next))
}

function formatTime(date) {
  return date.toTimeString().slice(0, 8)
}

function initialState() {
  const now = new Date()
  const timestamps = Array.from({ length: 10 }, (_, i) => formatTime(new Date(now.getTime() - (9 - i) * 1000)))
  const series = {}
  const current = {}
  SERIES_CONFIG.forEach((s) => {
    series[s.key] = Array.from({ length: 10 }, () => +(s.min + Math.random() * (s.max - s.min)).toFixed(2))
    current[s.key] = +(s.min + Math.random() * (s.max - s.min)).toFixed(2)
  })
  return { timestamps, series, current }
}

export default function RealtimeChartPage() {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const c = useChartColors()
  const [init] = useState(initialState)
  const [running, setRunning] = useState(true)
  const [speed, setSpeed] = useState('1x')
  const [timestamps, setTimestamps] = useState(init.timestamps)
  const [series, setSeries] = useState(init.series)
  const [current, setCurrent] = useState(init.current)
  const prevRef = useRef({ ...init.current })

  const addPoint = useCallback(() => {
    const now = formatTime(new Date())
    const newVals = {}
    SERIES_CONFIG.forEach((s) => {
      newVals[s.key] = +randomValue(s.min, s.max, prevRef.current[s.key] ?? (s.min + s.max) / 2).toFixed(2)
      prevRef.current[s.key] = newVals[s.key]
    })
    setTimestamps((prev) => [...prev.slice(-(MAX_POINTS - 1)), now])
    setSeries((prev) => {
      const next = {}
      SERIES_CONFIG.forEach((s) => {
        next[s.key] = [...prev[s.key].slice(-(MAX_POINTS - 1)), newVals[s.key]]
      })
      return next
    })
    setCurrent(newVals)
  }, [])

  useEffect(() => {
    if (!running) return
    const timer = setInterval(addPoint, SPEED_MS[speed] || 1000)
    return () => clearInterval(timer)
  }, [running, speed, addPoint])

  const handleClear = () => {
    setTimestamps([])
    setSeries(() => {
      const v = {}
      SERIES_CONFIG.forEach((s) => {
        v[s.key] = []
      })
      return v
    })
  }

  const option = useMemo(() => {
    const base = chartBase(c)
    return {
      ...base,
      color: SERIES_CONFIG.map((s) => c[s.colorVar]),
      tooltip: { ...base.tooltip, axisPointer: { type: 'cross', lineStyle: { color: c.border }, crossStyle: { color: c.border } } },
      legend: {
        data: SERIES_CONFIG.map((s) => t(s.name)),
        top: 0,
        right: 0,
        icon: 'roundRect',
        itemWidth: 12,
        itemHeight: 4,
        textStyle: { color: c['muted-foreground'], fontSize: 12 },
      },
      grid: { ...base.grid, top: 36 },
      xAxis: {
        ...base.xAxis,
        type: 'category',
        data: timestamps,
        boundaryGap: false,
        axisLabel: { ...base.xAxis.axisLabel, rotate: timestamps.length > 30 ? 30 : 0 },
      },
      yAxis: { ...base.yAxis, type: 'value' },
      series: SERIES_CONFIG.map((s) => ({
        name: t(s.name),
        type: 'line',
        data: series[s.key],
        smooth: true,
        symbol: 'none',
        lineStyle: { color: c[s.colorVar], width: 2 },
        areaStyle: { color: hexToRgba(c[s.colorVar], 0.06) },
        itemStyle: { color: c[s.colorVar] },
      })),
      animation: false,
    }
  }, [c, timestamps, series, t])

  return (
    <div className="space-y-5">
      <PageHeader
        title="实时折线图"
        actions={
          <>
            <StatusBadge tone={running ? 'success' : 'neutral'} dot className="mr-1">
              {running ? 'LIVE' : 'PAUSED'}
            </StatusBadge>
            <Select value={speed} onValueChange={setSpeed}>
              <SelectTrigger size="sm" className="h-8 w-[112px] text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPEED_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {t(o.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant={running ? 'outline' : 'brand'} onClick={() => setRunning((r) => !r)}>
              {running ? <Pause /> : <Play />}
              {running ? t('暂停') : t('继续')}
            </Button>
            <Button size="sm" variant="ghost" className="text-danger hover:text-danger" onClick={handleClear}>
              <Trash2 />
              {t('清空')}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {SERIES_CONFIG.map((s) => (
          <div key={s.key} className="surface-card relative overflow-hidden p-4">
            <span className={cn('absolute inset-y-3 left-0 w-0.5 rounded-full', s.accent)} />
            <div className="text-muted-foreground flex items-center gap-2 text-[13px]">
              <span className={cn('size-1.5 rounded-full', s.accent)} />
              {t(s.name)}
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-[26px] leading-none font-semibold tracking-tight tabular-nums">
                {current[s.key] ?? '--'}
              </span>
              <span className="text-muted-foreground text-xs">{s.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <Panel title="传感器曲线" description={t('最近 {{count}} 个采样点', { count: MAX_POINTS })}>
        <ReactECharts
          option={option}
          style={{ height: isMobile ? 240 : 400 }}
          opts={{ renderer: 'canvas' }}
          notMerge={false}
          lazyUpdate
        />
      </Panel>

    </div>
  )
}
