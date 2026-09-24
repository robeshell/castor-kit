import { useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { Activity, CalendarCheck, Flame, Trophy, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { chartBase, hexToRgba, useChartColors } from '@/lib/chart-theme'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'
import StatCard from '@/shared/components/StatCard'
import StatusBadge from '@/shared/components/StatusBadge'

// ── 日历热力图数据（近 1 年） ──────────────────────────────────────────
function generateCalendarData() {
  const data = []
  const now = new Date()
  for (let i = 364; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    // 工作日多，周末少；模拟提交/活跃记录
    const isWeekend = d.getDay() === 0 || d.getDay() === 6
    const base = isWeekend ? 2 : 8
    const value = Math.random() < 0.25 ? 0 : Math.floor(Math.random() * base + Math.random() * 10)
    data.push([dateStr, value])
  }
  return data
}

// ── 时段 × 星期热力数据 ────────────────────────────────────────────────
const HOURS = Array.from({ length: 24 }, (_, h) => `${h}时`)
const DAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function generateHourData() {
  const data = []
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const isWorkday = d >= 1 && d <= 5
      const isWorkHour = h >= 9 && h <= 18
      let base = 0
      if (isWorkday && isWorkHour) base = 30
      else if (isWorkday) base = 8
      else if (isWorkHour) base = 12
      else base = 3
      const val = Math.max(0, Math.floor(base + (Math.random() - 0.3) * base))
      if (val > 0) data.push([h, d, val])
    }
  }
  return data
}

// ── 年度统计 ──────────────────────────────────────────────────────────
function calcStats(calData) {
  const total = calData.reduce((s, [, v]) => s + v, 0)
  const activeDays = calData.filter(([, v]) => v > 0).length
  const maxDay = calData.reduce((mx, d) => (d[1] > mx[1] ? d : mx), ['', 0])
  let streak = 0
  let cur = 0
  for (const [, v] of calData) {
    cur = v > 0 ? cur + 1 : 0
    streak = Math.max(streak, cur)
  }
  return { total, activeDays, maxDay, streak }
}

/** 由主题色生成的顺序色阶：中性 → Ocean 蓝 */
function brandRamp(c) {
  return [
    hexToRgba(c['muted-foreground'], 0.12),
    hexToRgba(c['brand-to'], 0.45),
    hexToRgba(c['brand-via'], 0.65),
    hexToRgba(c['brand-from'], 0.85),
    c['brand-from'],
  ]
}

export default function HeatmapPage() {
  const c = useChartColors()
  const [calData, setCalData] = useState(() => generateCalendarData())
  const [hourData, setHourData] = useState(() => generateHourData())

  const handleRefresh = () => {
    setCalData(generateCalendarData())
    setHourData(generateHourData())
  }

  const stats = useMemo(() => calcStats(calData), [calData])
  const ramp = useMemo(() => brandRamp(c), [c])

  const calOption = useMemo(() => {
    const base = chartBase(c)
    return {
      textStyle: base.textStyle,
      tooltip: {
        ...base.tooltip,
        trigger: 'item',
        formatter: (p) => `${p.data[0]}<br/>活跃度：<b>${p.data[1]}</b>`,
      },
      visualMap: { min: 0, max: 18, show: false, inRange: { color: ramp } },
      calendar: {
        top: 24,
        left: 36,
        right: 12,
        cellSize: [14, 14],
        range: [calData[0][0], calData[calData.length - 1][0]],
        itemStyle: { borderWidth: 2, borderColor: c.card, color: 'transparent' },
        splitLine: { show: false },
        yearLabel: { show: false },
        dayLabel: {
          firstDay: 1,
          nameMap: ['日', '一', '二', '三', '四', '五', '六'],
          color: c['muted-foreground'],
          fontSize: 11,
        },
        monthLabel: { color: c['muted-foreground'], fontSize: 11 },
      },
      series: [{ type: 'heatmap', coordinateSystem: 'calendar', data: calData }],
    }
  }, [c, ramp, calData])

  const hourOption = useMemo(() => {
    const base = chartBase(c)
    const maxVal = Math.max(...hourData.map((d) => d[2]), 1)
    return {
      textStyle: base.textStyle,
      tooltip: {
        ...base.tooltip,
        trigger: 'item',
        position: 'top',
        formatter: (p) => `${DAYS[p.data[1]]} ${HOURS[p.data[0]]}<br/>活跃度：<b>${p.data[2]}</b>`,
      },
      grid: { top: 8, left: 8, right: 56, bottom: 8, containLabel: true },
      xAxis: {
        ...base.xAxis,
        type: 'category',
        data: HOURS,
        axisLabel: { ...base.xAxis.axisLabel, fontSize: 10, interval: 1 },
        splitArea: { show: false },
      },
      yAxis: {
        ...base.yAxis,
        type: 'category',
        data: DAYS,
        splitLine: { show: false },
        axisLabel: { ...base.yAxis.axisLabel, fontSize: 12, color: c.foreground },
      },
      visualMap: {
        min: 0,
        max: maxVal,
        calculable: true,
        orient: 'vertical',
        right: 0,
        top: 'center',
        itemHeight: 120,
        itemWidth: 10,
        inRange: { color: ramp },
        textStyle: { fontSize: 11, color: c['muted-foreground'] },
      },
      series: [
        {
          name: '活跃度',
          type: 'heatmap',
          data: hourData,
          label: { show: false },
          itemStyle: { borderColor: c.card, borderWidth: 2, borderRadius: 3 },
          emphasis: { itemStyle: { borderColor: c.foreground, borderWidth: 1 } },
        },
      ],
    }
  }, [c, ramp, hourData])

  return (
    <div className="space-y-5">
      <PageHeader
        title="热力日历图"
        actions={
          <Button size="sm" variant="outline" onClick={handleRefresh}>
            <RefreshCw />
            刷新数据
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="年度总活跃" value={stats.total} icon={Activity} />
        <StatCard label="活跃天数" value={stats.activeDays} suffix="天" icon={CalendarCheck} />
        <StatCard label="最长连续" value={stats.streak} suffix="天" icon={Flame} />
        <StatCard label="单日最高" value={stats.maxDay[1]} icon={Trophy} />
      </div>

      <Panel
        title={
          <span className="flex items-center gap-2">
            年度活跃日历
            <StatusBadge tone="brand">GitHub 贡献图风格</StatusBadge>
          </span>
        }
        description="近 365 天每日活跃度"
        actions={
          <div className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
            <span>少</span>
            {ramp.map((color) => (
              <span key={color} className="size-3 rounded-[3px]" style={{ background: color }} />
            ))}
            <span>多</span>
          </div>
        }
      >
        <div className="-mx-1 overflow-x-auto px-1">
          <ReactECharts option={calOption} style={{ height: 136, minWidth: 760 }} opts={{ renderer: 'canvas' }} notMerge />
        </div>
      </Panel>

      <Panel
        title={
          <span className="flex items-center gap-2">
            全周活跃热力矩阵
            <StatusBadge tone="info">24h × 7days</StatusBadge>
          </span>
        }
      >
        <div className="-mx-1 overflow-x-auto px-1">
          <ReactECharts option={hourOption} style={{ height: 240, minWidth: 600 }} opts={{ renderer: 'canvas' }} notMerge />
        </div>
      </Panel>
    </div>
  )
}
