import { useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { motion } from 'motion/react'
import { Gauge, RefreshCw, ShoppingCart, UserPlus, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { brandArea, brandLine, chartBase, hexToRgba, useChartColors } from '@/lib/chart-theme'
import { toast } from '@/lib/toast'
import DataTable from '@/shared/components/DataTable'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'
import StatCard from '@/shared/components/StatCard'
import StatusBadge from '@/shared/components/StatusBadge'

// ── 静态数据 ──────────────────────────────────────────────────────────
const KPI_DATA = [
  { title: '今日订单', value: 2847, unit: '单', trend: 12.3, up: true, goodWhenUp: true, icon: ShoppingCart, spark: [40, 55, 48, 62, 58, 70, 75, 68, 80, 85, 78, 92] },
  { title: '今日营收', value: 183920, unit: '元', trend: 8.7, up: true, goodWhenUp: true, icon: Wallet, spark: [60, 55, 70, 65, 80, 75, 90, 85, 100, 95, 110, 115] },
  { title: '新增用户', value: 342, unit: '人', trend: 3.2, up: false, goodWhenUp: true, icon: UserPlus, spark: [80, 75, 70, 72, 65, 68, 60, 62, 55, 58, 52, 50] },
  { title: '系统延迟', value: 128, unit: 'ms', trend: 15.4, up: false, goodWhenUp: false, icon: Gauge, spark: [200, 180, 170, 160, 155, 145, 150, 140, 135, 130, 125, 128] },
]

const WEEK_DAYS = [
  { label: '周一', value: 1240, isWeekend: false },
  { label: '周二', value: 1850, isWeekend: false },
  { label: '周三', value: 1620, isWeekend: false },
  { label: '周四', value: 2100, isWeekend: false },
  { label: '周五', value: 2480, isWeekend: false },
  { label: '周六', value: 1920, isWeekend: true },
  { label: '周日', value: 1560, isWeekend: true },
]

const PIE_DATA = [
  { name: '直接访问', value: 38 },
  { name: '搜索引擎', value: 28 },
  { name: '社交媒体', value: 20 },
  { name: '其他来源', value: 14 },
]

const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
const THIS_YEAR = [820, 932, 901, 934, 1290, 1330, 1320, 1100, 1280, 1400, 1450, 1680]
const LAST_YEAR = [620, 712, 801, 704, 990, 1030, 1020, 900, 980, 1100, 1150, 1280]

const PROGRESS_DATA = [
  { label: '华东大区', value: 84 },
  { label: '华南大区', value: 67 },
  { label: '华北大区', value: 72 },
  { label: '华中大区', value: 58 },
  { label: '西南大区', value: 45 },
]

const RECENT_EVENTS = [
  { id: 1, time: '14:32:10', type: '订单', level: 'success', content: '用户 u_88231 完成支付，金额 ¥2,380', region: '华东' },
  { id: 2, time: '14:28:45', type: '告警', level: 'warning', content: '数据库连接池使用率超过 80%', region: '系统' },
  { id: 3, time: '14:25:12', type: '用户', level: 'info', content: '新用户注册：u_98422，渠道：微信小程序', region: '华南' },
  { id: 4, time: '14:20:01', type: '订单', level: 'success', content: '批量发货完成，共 128 单', region: '华北' },
  { id: 5, time: '14:15:33', type: '系统', level: 'error', content: '第三方支付接口超时，已触发降级', region: '系统' },
  { id: 6, time: '14:10:07', type: '用户', level: 'info', content: '管理员 admin 登录系统', region: '华中' },
]

const LEVEL_META = {
  success: { label: '成功', tone: 'success' },
  warning: { label: '告警', tone: 'warning' },
  info: { label: '信息', tone: 'info' },
  error: { label: '异常', tone: 'danger' },
}

const EVENT_COLUMNS = [
  { key: 'time', title: '时间', dataIndex: 'time', width: 96, render: (v) => <span className="text-muted-foreground font-mono text-xs tabular-nums">{v}</span> },
  { key: 'type', title: '类型', dataIndex: 'type', width: 80, render: (v) => <StatusBadge>{v}</StatusBadge> },
  {
    key: 'level',
    title: '级别',
    dataIndex: 'level',
    width: 88,
    render: (v) => {
      const m = LEVEL_META[v] || { label: v, tone: 'neutral' }
      return (
        <StatusBadge tone={m.tone} dot>
          {m.label}
        </StatusBadge>
      )
    },
  },
  { key: 'content', title: '事件内容', dataIndex: 'content' },
  { key: 'region', title: '区域', dataIndex: 'region', width: 72, render: (v) => <span className="text-muted-foreground text-xs">{v}</span> },
]

// ── 子组件 ────────────────────────────────────────────────────────────
function BarChartCard({ c }) {
  const option = useMemo(() => {
    const base = chartBase(c)
    const colorOf = (weekend) => (weekend ? c['chart-3'] : c['chart-1'])
    return {
      ...base,
      tooltip: { ...base.tooltip, axisPointer: { type: 'shadow', shadowStyle: { color: hexToRgba(c['muted-foreground'], 0.08) } } },
      grid: { ...base.grid, top: 24 },
      xAxis: { ...base.xAxis, type: 'category', data: WEEK_DAYS.map((d) => d.label) },
      yAxis: {
        ...base.yAxis,
        type: 'value',
        axisLabel: { ...base.yAxis.axisLabel, formatter: (v) => (v >= 1000 ? `${v / 1000}k` : v) },
      },
      series: [
        {
          name: '订单量',
          type: 'bar',
          barMaxWidth: 32,
          itemStyle: {
            borderRadius: [6, 6, 2, 2],
            color: (params) => {
              const color = colorOf(WEEK_DAYS[params.dataIndex]?.isWeekend)
              return {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color },
                  { offset: 1, color: hexToRgba(color, 0.45) },
                ],
              }
            },
          },
          label: { show: true, position: 'top', fontSize: 11, color: c['muted-foreground'], fontWeight: 500 },
          data: WEEK_DAYS.map((d) => d.value),
        },
      ],
      animationDuration: 800,
      animationEasing: 'cubicOut',
    }
  }, [c])

  return (
    <Panel
      title="近 7 日订单量"
      actions={
        <div className="text-muted-foreground flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="bg-chart-1 size-2 rounded-full" />
            工作日
          </span>
          <span className="flex items-center gap-1.5">
            <span className="bg-chart-3 size-2 rounded-full" />
            周末
          </span>
        </div>
      }
      className="h-full"
    >
      <ReactECharts option={option} style={{ height: 248 }} notMerge opts={{ renderer: 'svg' }} />
    </Panel>
  )
}

function PieChartCard({ c }) {
  const option = useMemo(() => {
    const base = chartBase(c)
    return {
      color: base.color,
      textStyle: base.textStyle,
      tooltip: { ...base.tooltip, trigger: 'item', formatter: '{b}: <b>{c}%</b> ({d}%)' },
      legend: {
        orient: 'vertical',
        right: 4,
        top: 'center',
        itemWidth: 8,
        itemHeight: 8,
        itemGap: 14,
        icon: 'circle',
        formatter: (name) => {
          const item = PIE_DATA.find((d) => d.name === name)
          return `{name|${name}}  {val|${item?.value ?? 0}%}`
        },
        textStyle: {
          rich: {
            name: { color: c['muted-foreground'], fontSize: 12 },
            val: { color: c.foreground, fontSize: 12, fontWeight: 600 },
          },
        },
      },
      series: [
        {
          type: 'pie',
          radius: ['52%', '74%'],
          center: ['34%', '50%'],
          avoidLabelOverlap: true,
          padAngle: 2,
          itemStyle: { borderRadius: 6, borderColor: c.card, borderWidth: 2 },
          label: { show: false },
          emphasis: {
            scale: true,
            scaleSize: 5,
            label: { show: true, fontSize: 13, fontWeight: 600, color: c.foreground, formatter: '{b}\n{c}%' },
          },
          data: PIE_DATA,
        },
      ],
    }
  }, [c])

  return (
    <Panel title="流量来源分布" className="h-full">
      <ReactECharts option={option} style={{ height: 248 }} notMerge opts={{ renderer: 'svg' }} />
    </Panel>
  )
}

function LineChartCard({ c }) {
  const option = useMemo(() => {
    const base = chartBase(c)
    return {
      ...base,
      grid: { ...base.grid, top: 36 },
      legend: {
        top: 0,
        right: 0,
        icon: 'roundRect',
        itemWidth: 14,
        itemHeight: 4,
        textStyle: { color: c['muted-foreground'], fontSize: 12 },
      },
      xAxis: { ...base.xAxis, type: 'category', data: MONTHS, boundaryGap: false },
      yAxis: { ...base.yAxis, type: 'value' },
      series: [
        {
          name: '本年',
          type: 'line',
          smooth: 0.4,
          data: THIS_YEAR,
          symbol: 'circle',
          symbolSize: 7,
          showSymbol: false,
          color: c['brand-from'],
          lineStyle: { width: 2.4, color: brandLine(c) },
          itemStyle: { color: c['brand-from'], borderColor: c.card, borderWidth: 2 },
          areaStyle: brandArea(c),
        },
        {
          name: '去年',
          type: 'line',
          smooth: 0.4,
          data: LAST_YEAR,
          symbol: 'circle',
          symbolSize: 6,
          showSymbol: false,
          color: c['muted-foreground'],
          lineStyle: { width: 1.6, type: 'dashed', color: c['muted-foreground'] },
          itemStyle: { color: c['muted-foreground'], borderColor: c.card, borderWidth: 2 },
        },
      ],
      animationDuration: 900,
      animationEasing: 'cubicOut',
    }
  }, [c])

  return (
    <Panel title="全年订单趋势对比" className="h-full">
      <ReactECharts option={option} style={{ height: 248 }} notMerge opts={{ renderer: 'svg' }} />
    </Panel>
  )
}

function ProgressListCard() {
  return (
    <Panel title="各大区目标完成率" description="本季度累计" className="h-full">
      <div className="space-y-4 pt-1">
        {PROGRESS_DATA.map((item, i) => (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-mono font-medium tabular-nums">{item.value}%</span>
            </div>
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
              <motion.div
                className="bg-brand-gradient h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${item.value}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 22, delay: i * 0.05 }}
              />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const c = useChartColors()
  const [lastUpdated, setLastUpdated] = useState(() => new Date())

  const handleRefresh = () => {
    setLastUpdated(new Date())
    toast.success('数据已刷新')
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="数据大屏"
        actions={
          <>
            <span className="text-muted-foreground hidden items-center gap-2 text-xs sm:flex">
              <span className="relative flex size-1.5 rounded-full bg-success">
                <span className="bg-success absolute inset-0 animate-ping rounded-full opacity-60" />
              </span>
              更新于
              <span className="font-mono tabular-nums">
                {lastUpdated.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </span>
            <Button size="sm" variant="outline" onClick={handleRefresh}>
              <RefreshCw />
              刷新
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {KPI_DATA.map((kpi) => {
          const isGood = kpi.up ? kpi.goodWhenUp : !kpi.goodWhenUp
          return (
            <StatCard
              key={kpi.title}
              label={kpi.title}
              value={kpi.value}
              suffix={kpi.unit}
              icon={kpi.icon}
              delta={`${kpi.up ? '↑' : '↓'} ${kpi.trend}%`}
              deltaTone={isGood ? 'success' : 'danger'}
              trend={kpi.spark}
            />
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <BarChartCard c={c} />
        </div>
        <div className="lg:col-span-5">
          <PieChartCard c={c} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <LineChartCard c={c} />
        </div>
        <div className="lg:col-span-4">
          <ProgressListCard />
        </div>
      </div>

      <Panel
        title="最近事件"
        padded={false}
        actions={
          <StatusBadge tone="brand" dot>
            实时
          </StatusBadge>
        }
      >
        <DataTable data={RECENT_EVENTS} columns={EVENT_COLUMNS} bordered={false} dense minWidth={640} className="border-t" />
      </Panel>
    </div>
  )
}
