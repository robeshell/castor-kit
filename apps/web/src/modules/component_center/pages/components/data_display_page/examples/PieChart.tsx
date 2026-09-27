import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { EChartsOption } from 'echarts'
import { chartBase, useChartColors } from '@/lib/chart-theme'
import Chart from '@/shared/components/Chart'

const CHANNELS = [
  { name: '搜索', value: 4210 },
  { name: '直接访问', value: 2930 },
  { name: '社交媒体', value: 1860 },
  { name: '邮件', value: 940 },
  { name: '其他', value: 520 },
]

export default function PieChart() {
  const { t } = useTranslation()
  const c = useChartColors()
  const [picked, setPicked] = useState<string | null>(null)

  const option = useMemo((): EChartsOption => {
    const base = chartBase(c)
    return {
      color: base.color,
      textStyle: base.textStyle,
      tooltip: { ...base.tooltip, trigger: 'item' },
      legend: { bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { color: c['muted-foreground'], fontSize: 12 } },
      series: [
        {
          type: 'pie',
          radius: ['52%', '74%'],
          center: ['50%', '44%'],
          padAngle: 2,
          itemStyle: { borderRadius: 6, borderColor: c.card, borderWidth: 2 },
          label: { show: false },
          // Data names are display text too
          data: CHANNELS.map((ch) => ({ name: t(ch.name), value: ch.value })),
        },
      ],
    }
  }, [c, t])

  return (
    <div className="space-y-2">
      {/* onEvents binds echarts events by name; the handler gets echarts' event params */}
      <Chart
        option={option}
        style={{ height: 280 }}
        onEvents={{ click: (params: { name: string }) => setPicked(params.name) }}
      />
      <p className="text-muted-foreground text-center text-xs">{picked ? t('点击了：{{name}}', { name: picked }) : t('点击扇区试试')}</p>
    </div>
  )
}
