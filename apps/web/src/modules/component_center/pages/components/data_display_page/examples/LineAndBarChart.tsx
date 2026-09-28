import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { EChartsOption } from 'echarts'
import { brandArea, brandLine, chartBase, useChartColors } from '@/lib/chart-theme'
import { formatNumber } from '@/lib/format'
import Chart from '@/shared/components/Chart'
import Panel from '@/shared/components/Panel'
import SegmentedTabs from '@/shared/components/SegmentedTabs'

type Range = '7d' | '14d'

const DAYS: Record<Range, string[]> = {
  '7d': ['09-22', '09-23', '09-24', '09-25', '09-26', '09-27', '09-28'],
  '14d': ['09-15', '09-16', '09-17', '09-18', '09-19', '09-20', '09-21', '09-22', '09-23', '09-24', '09-25', '09-26', '09-27', '09-28'],
}
const VISITS: Record<Range, number[]> = {
  '7d': [1820, 2140, 1990, 2380, 2610, 1740, 1560],
  '14d': [1510, 1690, 1740, 1880, 2020, 1430, 1350, 1820, 2140, 1990, 2380, 2610, 1740, 1560],
}
const ORDERS: Record<Range, number[]> = {
  '7d': [132, 158, 141, 176, 190, 121, 104],
  '14d': [98, 112, 125, 131, 149, 90, 86, 132, 158, 141, 176, 190, 121, 104],
}

export default function LineAndBarChart() {
  const { t } = useTranslation()
  const [range, setRange] = useState<Range>('7d')
  // Theme colors read from CSS variables; recomputed when the theme or accent changes, so the chart follows both
  const c = useChartColors()

  // Typed as echarts' EChartsOption: a misspelled series or axis setting fails the type check
  const option = useMemo((): EChartsOption => {
    const base = chartBase(c)
    return {
      ...base,
      grid: { ...base.grid, top: 36 },
      // Legend and axis names are display text: translate them with t()
      legend: { top: 0, right: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: c['muted-foreground'], fontSize: 12 } },
      xAxis: { ...base.xAxis, type: 'category', data: DAYS[range] },
      yAxis: [
        { ...base.yAxis, type: 'value' },
        { ...base.yAxis, type: 'value', splitLine: { show: false } },
      ],
      series: [
        {
          name: t('访问量'),
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: VISITS[range],
          color: c['brand-from'],
          lineStyle: { width: 2.4, color: brandLine(c) },
          areaStyle: brandArea(c),
        },
        { name: t('订单数'), type: 'bar', yAxisIndex: 1, barMaxWidth: 14, data: ORDERS[range], color: c['chart-3'], itemStyle: { borderRadius: [4, 4, 0, 0] } },
      ],
    }
  }, [c, range, t])

  // summary is the text alternative screen readers read instead of the canvas: what the chart shows plus its key
  // numbers, computed from the same data and translated
  const visits = VISITS[range]
  const peak = Math.max(...visits)
  const summary = t('访问量与订单数图表，{{from}} 至 {{to}}，共 {{visits}} 次访问、{{orders}} 笔订单，访问最多的一天是 {{day}}（{{peak}} 次）', {
    from: DAYS[range][0],
    to: DAYS[range].at(-1),
    visits: formatNumber(visits.reduce((a, b) => a + b, 0)),
    orders: formatNumber(ORDERS[range].reduce((a, b) => a + b, 0)),
    day: DAYS[range][visits.indexOf(peak)],
    peak: formatNumber(peak),
  })

  return (
    <Panel
      title="访问与订单"
      actions={
        <SegmentedTabs
          variant="pill"
          value={range}
          onChange={setRange}
          items={[
            { value: '7d', label: '近 7 天' },
            { value: '14d', label: '近 14 天' },
          ]}
        />
      }
    >
      {/* Only a height: the width follows the container and the chart resizes with it. patterns adds decal fills so the
          two series can be told apart without color */}
      <Chart option={option} summary={summary} patterns style={{ height: 260 }} notMerge />
    </Panel>
  )
}
