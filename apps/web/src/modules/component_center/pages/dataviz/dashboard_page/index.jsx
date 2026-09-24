import { CARD_STYLE } from '@/shared/styles'
import { useState } from 'react'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import ReactECharts from 'echarts-for-react'
import { Button, Progress, Space, Table, Tag, Toast, Typography } from '@douyinfe/semi-ui'
import { IconArrowDown, IconArrowUp, IconRefresh } from '@douyinfe/semi-icons'

// ── 样式常量 ──────────────────────────────────────────────────────────

// ECharts 不支持 CSS 变量，统一用实际颜色值
const C = {
  border: '#eaedf1',
  text0: '#1a1a1a',
  text1: '#434343',
  text2: '#8c8c8c',
  text3: '#bfbfbf',
  bg: 'transparent',
  // 主色板
  blue:   '#4080FF',
  green:  '#00B96B',
  orange: '#FA8C16',
  purple: '#9254DE',
  red:    '#FF4D4F',
  cyan:   '#13C2C2',
}

// 真实 DOM 颜色 → Semi Design CSS 变量（暗黑模式自适应）
const DOM = {
  text1: 'var(--semi-color-text-1)',
  text2: 'var(--semi-color-text-2)',
  text3: 'var(--semi-color-text-3)',
}

// ── 静态数据 ──────────────────────────────────────────────────────────
const KPI_DATA = [
  { title: '今日订单',  value: '2,847',   unit: '单',  trend: 12.3, up: true,  goodWhenUp: true,  color: C.blue,   spark: [40,55,48,62,58,70,75,68,80,85,78,92] },
  { title: '今日营收',  value: '183,920', unit: '元',  trend: 8.7,  up: true,  goodWhenUp: true,  color: C.green,  spark: [60,55,70,65,80,75,90,85,100,95,110,115] },
  { title: '新增用户',  value: '342',     unit: '人',  trend: 3.2,  up: false, goodWhenUp: true,  color: C.orange, spark: [80,75,70,72,65,68,60,62,55,58,52,50] },
  { title: '系统延迟',  value: '128',     unit: 'ms', trend: 15.4, up: false, goodWhenUp: false, color: C.purple, spark: [200,180,170,160,155,145,150,140,135,130,125,128] },
]

const PROGRESS_DATA = [
  { label: '华东大区', value: 84, color: C.blue },
  { label: '华南大区', value: 67, color: C.green },
  { label: '华北大区', value: 72, color: C.purple },
  { label: '华中大区', value: 58, color: C.orange },
  { label: '西南大区', value: 45, color: C.red },
]

const RECENT_EVENTS = [
  { id: 1, time: '14:32:10', type: '订单', level: 'success', content: '用户 u_88231 完成支付，金额 ¥2,380', region: '华东' },
  { id: 2, time: '14:28:45', type: '告警', level: 'warning', content: '数据库连接池使用率超过 80%', region: '系统' },
  { id: 3, time: '14:25:12', type: '用户', level: 'info',    content: '新用户注册：u_98422，渠道：微信小程序', region: '华南' },
  { id: 4, time: '14:20:01', type: '订单', level: 'success', content: '批量发货完成，共 128 单', region: '华北' },
  { id: 5, time: '14:15:33', type: '系统', level: 'error',   content: '第三方支付接口超时，已触发降级', region: '系统' },
  { id: 6, time: '14:10:07', type: '用户', level: 'info',    content: '管理员 admin 登录系统', region: '华中' },
]

const LEVEL_META = {
  success: { label: '成功', color: 'green' },
  warning: { label: '告警', color: 'orange' },
  info:    { label: '信息', color: 'blue' },
  error:   { label: '异常', color: 'red' },
}

// ── ECharts option 工厂 ───────────────────────────────────────────────
function makeSparkOption(data, color) {
  return {
    backgroundColor: C.bg,
    animation: false,
    grid: { top: 2, bottom: 2, left: 2, right: 2 },
    xAxis: { type: 'category', show: false, boundaryGap: false },
    yAxis: { type: 'value', show: false, scale: true },
    series: [{
      type: 'line',
      data,
      smooth: 0.4,
      symbol: 'none',
      lineStyle: { color, width: 2 },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: color + '50' },
            { offset: 1, color: color + '05' },
          ],
        },
      },
    }],
  }
}

function makeBarOption(days) {
  return {
    backgroundColor: C.bg,
    animation: true,
    grid: { top: 24, bottom: 28, left: 40, right: 12 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'var(--semi-color-bg-1)',
      borderColor: C.border,
      borderWidth: 1,
      textStyle: { color: C.text1, fontSize: 12 },
    },
    xAxis: {
      type: 'category',
      data: days.map((d) => d.label),
      axisLine: { lineStyle: { color: C.border } },
      axisTick: { show: false },
      axisLabel: { color: C.text2, fontSize: 12 },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: C.border, type: 'dashed' } },
      axisLabel: { color: C.text2, fontSize: 11, formatter: (v) => v >= 1000 ? `${v / 1000}k` : v },
    },
    series: [{
      name: '订单量',
      type: 'bar',
      barMaxWidth: 36,
      itemStyle: {
        borderRadius: [4, 4, 0, 0],
        color: (params) => {
          const isWeekend = days[params.dataIndex]?.isWeekend
          const baseColor = isWeekend ? C.green : C.blue
          return {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: baseColor },
              { offset: 1, color: baseColor + 'aa' },
            ],
          }
        },
      },
      label: { show: true, position: 'top', fontSize: 11, color: C.text1, fontWeight: 500 },
      data: days.map((d) => d.value),
    }],
  }
}

function makePieOption(pieData) {
  return {
    backgroundColor: C.bg,
    animation: true,
    tooltip: {
      trigger: 'item',
      formatter: '{b}: <b>{c}%</b> ({d}%)',
      backgroundColor: 'var(--semi-color-bg-1)',
      borderColor: C.border,
      borderWidth: 1,
      textStyle: { color: C.text1, fontSize: 12 },
    },
    legend: {
      orient: 'vertical',
      right: 8,
      top: 'center',
      itemWidth: 10,
      itemHeight: 10,
      icon: 'circle',
      textStyle: { color: C.text1, fontSize: 12 },
      formatter: (name) => {
        const item = pieData.find((d) => d.name === name)
        return `{name|${name}}  {val|${item?.value ?? 0}%}`
      },
      rich: {
        name: { color: C.text1, fontSize: 12 },
        val:  { color: C.text2, fontSize: 12, fontWeight: 600 },
      },
    },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['38%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      emphasis: {
        scale: true,
        scaleSize: 6,
        label: { show: true, fontSize: 13, fontWeight: 'bold', color: C.text0 },
      },
      data: pieData,
    }],
  }
}

function makeLineOption(months, dataA, dataB) {
  return {
    backgroundColor: C.bg,
    animation: true,
    grid: { top: 28, bottom: 28, left: 48, right: 20 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'var(--semi-color-bg-1)',
      borderColor: C.border,
      borderWidth: 1,
      textStyle: { color: C.text1, fontSize: 12 },
    },
    legend: {
      top: 0,
      right: 0,
      icon: 'roundRect',
      itemWidth: 16,
      itemHeight: 4,
      textStyle: { color: C.text2, fontSize: 12 },
    },
    xAxis: {
      type: 'category',
      data: months,
      boundaryGap: false,
      axisLine: { lineStyle: { color: C.border } },
      axisTick: { show: false },
      axisLabel: { color: C.text2, fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: C.border, type: 'dashed' } },
      axisLabel: { color: C.text2, fontSize: 11 },
    },
    series: [
      {
        name: '本年',
        type: 'line',
        smooth: 0.4,
        data: dataA,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: C.blue, width: 2.5 },
        itemStyle: { color: C.blue, borderColor: '#fff', borderWidth: 2 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: C.blue + '40' },
              { offset: 1, color: C.blue + '05' },
            ],
          },
        },
      },
      {
        name: '去年',
        type: 'line',
        smooth: 0.4,
        data: dataB,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: C.green, width: 2, type: 'dashed' },
        itemStyle: { color: C.green, borderColor: '#fff', borderWidth: 2 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: C.green + '28' },
              { offset: 1, color: C.green + '00' },
            ],
          },
        },
      },
    ],
  }
}

// ── 子组件 ────────────────────────────────────────────────────────────
function KpiCard({ title, value, unit, trend, up, goodWhenUp, color, spark }) {
  const isMobile = useIsMobile()
  const isGood = up ? goodWhenUp : !goodWhenUp
  const trendColor = isGood ? C.green : C.red
  return (
    <div style={{ ...CARD_STYLE }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <Typography.Text style={{ color: DOM.text2, fontSize: 12 }}>{title}</Typography.Text>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, margin: '6px 0 4px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: isMobile ? 22 : 30, fontWeight: 700, lineHeight: 1, color, fontVariantNumeric: 'tabular-nums' }}>
              {value}
            </span>
            <Typography.Text style={{ color: DOM.text3, fontSize: 12 }}>{unit}</Typography.Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            {up
              ? <IconArrowUp size="small" style={{ color: trendColor }} />
              : <IconArrowDown size="small" style={{ color: trendColor }} />
            }
            <span style={{ fontSize: 12, color: trendColor, fontWeight: 600 }}>{trend}%</span>
            {!isMobile && <span style={{ fontSize: 12, color: DOM.text3, marginLeft: 2 }}>较昨日</span>}
          </div>
        </div>
        {!isMobile && (
          <ReactECharts
            option={makeSparkOption(spark, color)}
            style={{ width: 96, height: 44, flexShrink: 0, marginTop: 4 }}
            opts={{ renderer: 'svg' }}
          />
        )}
      </div>
    </div>
  )
}

function BarChartCard() {
  const days = [
    { label: '周一', value: 1240, isWeekend: false },
    { label: '周二', value: 1850, isWeekend: false },
    { label: '周三', value: 1620, isWeekend: false },
    { label: '周四', value: 2100, isWeekend: false },
    { label: '周五', value: 2480, isWeekend: false },
    { label: '周六', value: 1920, isWeekend: true  },
    { label: '周日', value: 1560, isWeekend: true  },
  ]
  return (
    <div style={{ ...CARD_STYLE }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
        <Typography.Text strong>近 7 日订单量</Typography.Text>
        <Space>
          {[{ label: '工作日', color: C.blue }, { label: '周末', color: C.green }].map((l) => (
            <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, display: 'inline-block' }} />
              <Typography.Text size="small" style={{ color: DOM.text2 }}>{l.label}</Typography.Text>
            </span>
          ))}
        </Space>
      </div>
      <ReactECharts option={makeBarOption(days)} style={{ height: 240 }} />
    </div>
  )
}

function PieChartCard() {
  const pieData = [
    { name: '直接访问', value: 38, itemStyle: { color: C.blue   } },
    { name: '搜索引擎', value: 28, itemStyle: { color: C.green  } },
    { name: '社交媒体', value: 20, itemStyle: { color: C.orange } },
    { name: '其他来源', value: 14, itemStyle: { color: C.purple } },
  ]
  return (
    <div style={{ ...CARD_STYLE }}>
      <Typography.Text strong style={{ display: 'block', marginBottom: 2 }}>流量来源分布</Typography.Text>
      <ReactECharts option={makePieOption(pieData)} style={{ height: 240 }} />
    </div>
  )
}

function LineChartCard() {
  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
  const dataA  = [820, 932, 901, 934, 1290, 1330, 1320, 1100, 1280, 1400, 1450, 1680]
  const dataB  = [620, 712, 801, 704,  990, 1030, 1020,  900,  980, 1100, 1150, 1280]
  return (
    <div style={{ ...CARD_STYLE }}>
      <Typography.Text strong style={{ display: 'block', marginBottom: 2 }}>全年订单趋势对比</Typography.Text>
      <ReactECharts option={makeLineOption(months, dataA, dataB)} style={{ height: 240 }} />
    </div>
  )
}

function ProgressListCard() {
  return (
    <div style={{ ...CARD_STYLE }}>
      <Typography.Text strong style={{ display: 'block', marginBottom: 18 }}>各大区目标完成率</Typography.Text>
      {PROGRESS_DATA.map((item) => (
        <div key={item.label} style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <Typography.Text size="small" style={{ color: DOM.text1 }}>{item.label}</Typography.Text>
            <Typography.Text size="small" style={{ color: item.color, fontWeight: 600 }}>{item.value}%</Typography.Text>
          </div>
          <Progress percent={item.value} stroke={item.color} size="small" showInfo={false} />
        </div>
      ))}
    </div>
  )
}

function RecentEventsCard() {
  const columns = [
    {
      title: '时间', dataIndex: 'time', width: 90,
      render: (v) => <span style={{ fontSize: 12, color: DOM.text2 }}>{v}</span>,
    },
    {
      title: '类型', dataIndex: 'type', width: 72,
      render: (v) => <Tag>{v}</Tag>,
    },
    {
      title: '级别', dataIndex: 'level', width: 72,
      render: (v) => {
        const m = LEVEL_META[v] || { label: v, color: 'grey' }
        return <Tag color={m.color}>{m.label}</Tag>
      },
    },
    { title: '事件内容', dataIndex: 'content' },
    {
      title: '区域', dataIndex: 'region', width: 70,
      render: (v) => <span style={{ fontSize: 12, color: DOM.text2 }}>{v}</span>,
    },
  ]
  return (
    <div style={{ ...CARD_STYLE }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Typography.Text strong>最近事件</Typography.Text>
        <Tag color="blue" style={{ fontSize: 11 }}>实时</Tag>
      </div>
      <Table size="small" columns={columns} dataSource={RECENT_EVENTS} rowKey="id" pagination={false} />
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const isMobile = useIsMobile()
  const [lastUpdated, setLastUpdated] = useState(() => new Date())

  const handleRefresh = () => {
    setLastUpdated(new Date())
    Toast.success('数据已刷新')
  }

  return (
    <div style={{ background: 'var(--semi-color-bg-0)', margin: isMobile ? -8 : -24, padding: isMobile ? 8 : 24, minHeight: '100%' }}>

      {/* 页面标题 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <Typography.Title heading={5} style={{ marginBottom: 4 }}>数据大屏</Typography.Title>
          {!isMobile && (
            <Typography.Paragraph type="tertiary">
              展示 KPI 卡片、ECharts 折线图 / 柱状图 / 环形图、进度列表等数据可视化布局的组合示例。
            </Typography.Paragraph>
          )}
        </div>
        <Space style={{ marginTop: 4, flexShrink: 0 }}>
          {!isMobile && (
            <Typography.Text type="tertiary" size="small">
              更新于 {lastUpdated.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </Typography.Text>
          )}
          <Button icon={<IconRefresh />} size="small" onClick={handleRefresh}>刷新</Button>
        </Space>
      </div>

      {/* KPI 卡片行 */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
        {KPI_DATA.map((kpi, idx) => (
          <KpiCard key={kpi.title} {...kpi} idx={idx} />
        ))}
      </div>

      {/* 图表第一行：柱状图 + 环形图 */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '7fr 5fr', gap: 12, marginBottom: 12 }}>
        <BarChartCard />
        <PieChartCard />
      </div>

      {/* 图表第二行：折线图 + 进度列表 */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '8fr 4fr', gap: 12, marginBottom: 12 }}>
        <LineChartCard />
        <ProgressListCard />
      </div>

      {/* 最近事件表格 */}
      <RecentEventsCard />
    </div>
  )
}
