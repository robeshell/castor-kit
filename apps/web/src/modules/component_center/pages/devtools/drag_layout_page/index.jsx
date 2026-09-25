import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import GridLayout, { useContainerWidth } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import ReactECharts from 'echarts-for-react'
import { GripVertical, Info, Lock, RotateCcw, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { brandArea, brandLine, chartBase, useChartColors } from '@/lib/chart-theme'
import { EASE_OUT } from '@/lib/motion'
import { cn } from '@/lib/utils'
import DataTable from '@/shared/components/DataTable'
import PageHeader from '@/shared/components/PageHeader'
import StatusBadge from '@/shared/components/StatusBadge'
import './drag-layout.css'

// 布局保存在 localStorage，按版本号区分格式
const STORAGE_KEY = 'castor_kit_drag_layout_v1'

// ── 默认布局 ──────────────────────────────────────────────────────────
const DEFAULT_LAYOUT = [
  { i: 'line-chart', x: 0, y: 0, w: 6, h: 4 },
  { i: 'pie-chart', x: 6, y: 0, w: 6, h: 4 },
  { i: 'stat-cards', x: 0, y: 4, w: 3, h: 2 },
  { i: 'data-table', x: 3, y: 4, w: 6, h: 4 },
  { i: 'progress', x: 9, y: 4, w: 3, h: 2 },
  { i: 'sys-log', x: 0, y: 6, w: 3, h: 4 },
]

const GRID_CONFIG = { cols: 12, rowHeight: 80, margin: [12, 12], containerPadding: [0, 0] }

// ── 静态数据 ──────────────────────────────────────────────────────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const SALES = [420, 532, 601, 734, 690, 810, 876, 950, 888, 1020, 1100, 1280]
const SHARE = [
  { name: '华东', value: 35 },
  { name: '华南', value: 25 },
  { name: '华北', value: 20 },
  { name: '西南', value: 15 },
  { name: '其他', value: 5 },
]

const STAT_DATA = [
  { label: '总用户数', value: '182,430' },
  { label: '今日活跃', value: '34,821' },
  { label: '转化率', value: '19.1%' },
]

const STATUS_TONE = { 已完成: 'success', 处理中: 'warning', 已取消: 'danger' }

const TABLE_COLUMNS = [
  { key: 'id', title: '订单号', dataIndex: 'id', width: 100, render: (v) => <span className="font-mono text-xs">{v}</span> },
  { key: 'customer', title: '客户', dataIndex: 'customer', width: 90 },
  { key: 'amount', title: '金额(元)', dataIndex: 'amount', width: 100, align: 'right', render: (v) => <span className="tabular-nums">{v}</span> },
  {
    key: 'status',
    title: '状态',
    dataIndex: 'status',
    width: 90,
    render: (v) => (
      <StatusBadge tone={STATUS_TONE[v] || 'neutral'} dot>
        {v}
      </StatusBadge>
    ),
  },
  { key: 'date', title: '日期', dataIndex: 'date', width: 100, render: (v) => <span className="text-muted-foreground tabular-nums">{v}</span> },
]

const TABLE_DATA = Array.from({ length: 10 }, (_, i) => ({
  id: `ORD-${1000 + i}`,
  customer: `客户${String(i + 1).padStart(3, '0')}`,
  amount: (3000 + i * 1234).toLocaleString(),
  status: ['已完成', '处理中', '已取消'][i % 3],
  date: `2025-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
}))

const PROGRESS_DATA = [
  { label: '研发部', value: 88 },
  { label: '产品部', value: 72 },
  { label: '市场部', value: 61 },
  { label: '运营部', value: 79 },
  { label: '财务部', value: 55 },
]

const LOG_LEVEL = {
  success: { tone: 'success', label: 'OK' },
  warning: { tone: 'warning', label: 'WARN' },
  danger: { tone: 'danger', label: 'ERR' },
  info: { tone: 'info', label: 'INFO' },
}

const LOG_DATA = [
  { time: '14:32:10', level: 'success', msg: 'API /api/users 响应正常，耗时 42ms' },
  { time: '14:31:58', level: 'warning', msg: 'DB 连接池使用率 78%，接近阈值' },
  { time: '14:31:40', level: 'info', msg: '定时任务 sync_orders 执行完成，同步 320 条' },
  { time: '14:30:22', level: 'success', msg: '用户 admin 登录成功，IP: 192.168.1.10' },
  { time: '14:29:55', level: 'danger', msg: 'Redis 连接超时，已触发重连机制' },
  { time: '14:28:11', level: 'info', msg: '缓存预热完成，命中率提升至 94.3%' },
  { time: '14:27:03', level: 'warning', msg: '第三方短信服务响应慢，P99 > 2s' },
]

function readSavedLayout() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : DEFAULT_LAYOUT
  } catch {
    return DEFAULT_LAYOUT
  }
}

// ── GridItem 容器 ──────────────────────────────────────────────────────
function GridItem({ title, isEditing, children }) {
  return (
    <div
      className={cn(
        'surface-card flex h-full flex-col overflow-hidden transition-shadow duration-200',
        isEditing && 'ring-primary/40 ring-1 ring-offset-0',
      )}
    >
      <div
        className={cn(
          'flex h-9 shrink-0 items-center justify-between border-b px-3 select-none',
          isEditing ? 'drag-handle bg-muted/50 cursor-move' : 'cursor-default',
        )}
      >
        <span className="truncate text-[13px] font-medium">{title}</span>
        {isEditing ? <GripVertical className="text-muted-foreground size-4" /> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden p-2">{children}</div>
    </div>
  )
}

// ── 组件内容 ──────────────────────────────────────────────────────────
function LineChartWidget() {
  const c = useChartColors()
  const option = useMemo(() => {
    const base = chartBase(c)
    return {
      ...base,
      grid: { ...base.grid, top: 12 },
      xAxis: { ...base.xAxis, type: 'category', data: MONTHS, boundaryGap: false },
      yAxis: { ...base.yAxis, type: 'value' },
      series: [
        {
          name: '销售额',
          type: 'line',
          smooth: true,
          data: SALES,
          showSymbol: false,
          color: c['brand-from'],
          lineStyle: { width: 2.2, color: brandLine(c) },
          itemStyle: { color: c['brand-from'], borderColor: c.card, borderWidth: 2 },
          areaStyle: brandArea(c),
        },
      ],
    }
  }, [c])
  return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} notMerge />
}

function PieChartWidget() {
  const c = useChartColors()
  const option = useMemo(() => {
    const base = chartBase(c)
    return {
      color: base.color,
      textStyle: base.textStyle,
      tooltip: { ...base.tooltip, trigger: 'item', formatter: '{b}: {d}%' },
      legend: {
        orient: 'vertical',
        right: 8,
        top: 'center',
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { color: c['muted-foreground'], fontSize: 12 },
      },
      series: [
        {
          name: '市场份额',
          type: 'pie',
          radius: ['46%', '72%'],
          center: ['38%', '50%'],
          padAngle: 2,
          itemStyle: { borderRadius: 5, borderColor: c.card, borderWidth: 2 },
          data: SHARE,
          label: { show: false },
        },
      ],
    }
  }, [c])
  return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} notMerge />
}

function StatCardsWidget() {
  return (
    <div className="flex h-full flex-col justify-center gap-1.5">
      {STAT_DATA.map((s) => (
        <div key={s.label} className="bg-muted/50 flex items-center justify-between rounded-lg px-3 py-1.5">
          <span className="text-muted-foreground text-xs">{s.label}</span>
          <span className="text-sm font-semibold tabular-nums">{s.value}</span>
        </div>
      ))}
    </div>
  )
}

function DataTableWidget() {
  return (
    <div className="-m-2 h-[calc(100%+1rem)] overflow-auto">
      <DataTable data={TABLE_DATA} columns={TABLE_COLUMNS} bordered={false} dense minWidth={480} />
    </div>
  )
}

function ProgressWidget() {
  return (
    <div className="flex h-full flex-col justify-center gap-2.5 px-1">
      {PROGRESS_DATA.map((p) => (
        <div key={p.label} className="grid grid-cols-[44px_minmax(0,1fr)_32px] items-center gap-2 text-[11px]">
          <span className="text-muted-foreground">{p.label}</span>
          <div className="bg-muted h-1 overflow-hidden rounded-full">
            <div className="bg-brand-gradient h-full rounded-full" style={{ width: `${p.value}%` }} />
          </div>
          <span className="text-right font-mono tabular-nums">{p.value}%</span>
        </div>
      ))}
    </div>
  )
}

function SysLogWidget() {
  return (
    <div className="h-full overflow-y-auto">
      {LOG_DATA.map((log) => {
        const meta = LOG_LEVEL[log.level] || LOG_LEVEL.info
        return (
          <div key={`${log.time}-${log.msg}`} className="flex items-start gap-2 border-b px-0.5 py-1.5 last:border-b-0">
            <span className="text-muted-foreground shrink-0 font-mono text-[10px] leading-5 tabular-nums">{log.time}</span>
            <StatusBadge tone={meta.tone} className="h-[18px] shrink-0 px-1 text-[10px]">
              {meta.label}
            </StatusBadge>
            <span className="text-[11px] leading-5 break-all">{log.msg}</span>
          </div>
        )
      })}
    </div>
  )
}

const WIDGET_MAP = {
  'line-chart': { title: '折线图 · 月度销售', Component: LineChartWidget },
  'pie-chart': { title: '饼图 · 市场份额', Component: PieChartWidget },
  'stat-cards': { title: '数字卡 · 核心指标', Component: StatCardsWidget },
  'data-table': { title: '数据表格 · 订单列表', Component: DataTableWidget },
  progress: { title: '进度条 · 部门完成率', Component: ProgressWidget },
  'sys-log': { title: '系统日志', Component: SysLogWidget },
}

// ── 主页面 ──────────────────────────────────────────────────────────
export default function DragLayoutPage() {
  const { width, containerRef, mounted } = useContainerWidth({ measureBeforeMount: true })
  const [isEditing, setIsEditing] = useState(false)
  const [layout, setLayout] = useState(readSavedLayout)

  const handleLayoutChange = (newLayout) => {
    setLayout(newLayout)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newLayout))
    } catch {
      /* ignore */
    }
  }

  const handleReset = () => {
    setLayout(DEFAULT_LAYOUT)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="拖拽布局"
        actions={
          <>
            <Button size="sm" variant={isEditing ? 'brand' : 'outline'} onClick={() => setIsEditing((v) => !v)}>
              {isEditing ? <Lock /> : <Unlock />}
              {isEditing ? '锁定布局' : '编辑布局'}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleReset}>
              <RotateCcw />
              重置布局
            </Button>
          </>
        }
      />

      <AnimatePresence initial={false}>
        {isEditing ? (
          <motion.div
            key="tip"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div className="bg-brand-soft text-primary flex items-center gap-2 rounded-lg px-3 py-2 text-xs">
              <Info className="size-3.5 shrink-0" />
              编辑模式已开启 · 拖拽卡片标题栏移动位置，拖拽卡片右下角调整大小，布局会自动保存至本地
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* 窄屏下网格保持最小宽度，外层横向滚动 */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div ref={containerRef} className="drag-layout min-w-[880px]">
          {mounted ? (
            <GridLayout
              className="layout"
              layout={layout}
              width={width}
              gridConfig={GRID_CONFIG}
              dragConfig={{ enabled: isEditing, handle: '.drag-handle' }}
              resizeConfig={{ enabled: isEditing }}
              onLayoutChange={handleLayoutChange}
            >
              {layout.map(({ i }) => {
                const meta = WIDGET_MAP[i]
                if (!meta) return null
                const { title, Component } = meta
                return (
                  <div key={i}>
                    <GridItem title={title} isEditing={isEditing}>
                      <Component />
                    </GridItem>
                  </div>
                )
              })}
            </GridLayout>
          ) : null}
        </div>
      </div>
    </div>
  )
}
