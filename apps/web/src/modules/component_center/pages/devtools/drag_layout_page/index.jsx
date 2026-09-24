import { CARD_STYLE } from '@/shared/styles'
import { useEffect, useRef, useState } from 'react'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import GridLayout from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import ReactECharts from 'echarts-for-react'
import { Button, Progress, Space, Table, Tag, Typography } from '@douyinfe/semi-ui'
import { IconLock, IconUnlock, IconRefresh } from '@douyinfe/semi-icons'

const { Title, Text } = Typography

// ── 样式常量 ──────────────────────────────────────────────────────────

const C = {
  blue: '#4080FF', green: '#00B96B', orange: '#FA8C16',
  purple: '#9254DE', red: '#FF4D4F', cyan: '#13C2C2',
  border: '#eaedf1', text0: '#1a1a1a', text1: '#434343', text2: '#8c8c8c',
}

// 真实 DOM 颜色 → Semi Design CSS 变量（暗黑模式自适应）
const DOM = {
  blue:   'var(--semi-color-primary)',
  border: 'var(--semi-color-border)',
  text0:  'var(--semi-color-text-0)',
  text1:  'var(--semi-color-text-1)',
  text2:  'var(--semi-color-text-2)',
}

const STORAGE_KEY = 'aurastack_drag_layout_v1'

// ── 默认布局 ──────────────────────────────────────────────────────────
const DEFAULT_LAYOUT = [
  { i: 'line-chart',  x: 0, y: 0,  w: 6, h: 4 },
  { i: 'pie-chart',   x: 6, y: 0,  w: 6, h: 4 },
  { i: 'stat-cards',  x: 0, y: 4,  w: 3, h: 2 },
  { i: 'data-table',  x: 3, y: 4,  w: 6, h: 4 },
  { i: 'progress',    x: 9, y: 4,  w: 3, h: 2 },
  { i: 'sys-log',     x: 0, y: 6,  w: 3, h: 4 },
]

// ── 静态数据 ──────────────────────────────────────────────────────────
const LINE_OPTION = {
  tooltip: { trigger: 'axis' },
  grid: { top: 20, right: 16, bottom: 20, left: 40 },
  xAxis: {
    type: 'category',
    data: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    axisLine: { lineStyle: { color: C.border } },
    axisLabel: { color: C.text2, fontSize: 11 },
  },
  yAxis: {
    type: 'value',
    axisLabel: { color: C.text2, fontSize: 11 },
    splitLine: { lineStyle: { color: C.border } },
  },
  series: [{
    name: '销售额',
    type: 'line',
    smooth: true,
    data: [420, 532, 601, 734, 690, 810, 876, 950, 888, 1020, 1100, 1280],
    itemStyle: { color: C.blue },
    areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(64,128,255,0.25)' }, { offset: 1, color: 'rgba(64,128,255,0)' }] } },
  }],
}

const PIE_OPTION = {
  tooltip: { trigger: 'item', formatter: '{b}: {d}%' },
  legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { color: C.text1, fontSize: 12 } },
  series: [{
    name: '市场份额',
    type: 'pie',
    radius: ['40%', '70%'],
    center: ['38%', '50%'],
    data: [
      { name: '华东', value: 35, itemStyle: { color: C.blue } },
      { name: '华南', value: 25, itemStyle: { color: C.green } },
      { name: '华北', value: 20, itemStyle: { color: C.purple } },
      { name: '西南', value: 15, itemStyle: { color: C.orange } },
      { name: '其他', value: 5,  itemStyle: { color: C.cyan } },
    ],
    label: { show: false },
  }],
}

const STAT_DATA = [
  { label: '总用户数',   value: '182,430', color: C.blue },
  { label: '今日活跃',   value: '34,821',  color: C.green },
  { label: '转化率',     value: '19.1%',   color: C.orange },
]

const TABLE_COLUMNS = [
  { title: '订单号',   dataIndex: 'id',      width: 100 },
  { title: '客户',     dataIndex: 'customer', width: 90 },
  { title: '金额(元)', dataIndex: 'amount',   width: 100 },
  { title: '状态',     dataIndex: 'status',   width: 80,
    render: v => <Tag color={v === '已完成' ? 'green' : v === '处理中' ? 'orange' : 'red'} size="small">{v}</Tag> },
  { title: '日期',     dataIndex: 'date',     width: 100 },
]

const TABLE_DATA = Array.from({ length: 10 }, (_, i) => ({
  id: `ORD-${1000 + i}`,
  customer: `客户${String(i + 1).padStart(3, '0')}`,
  amount: (3000 + i * 1234).toLocaleString(),
  status: ['已完成','处理中','已取消'][i % 3],
  date: `2025-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
  key: i,
}))

const PROGRESS_DATA = [
  { label: '研发部', value: 88, color: C.blue },
  { label: '产品部', value: 72, color: C.green },
  { label: '市场部', value: 61, color: C.orange },
  { label: '运营部', value: 79, color: C.purple },
  { label: '财务部', value: 55, color: C.cyan },
]

const LOG_DATA = [
  { time: '14:32:10', level: 'success', msg: 'API /api/users 响应正常，耗时 42ms' },
  { time: '14:31:58', level: 'warning', msg: 'DB 连接池使用率 78%，接近阈值' },
  { time: '14:31:40', level: 'info',    msg: '定时任务 sync_orders 执行完成，同步 320 条' },
  { time: '14:30:22', level: 'success', msg: '用户 admin 登录成功，IP: 192.168.1.10' },
  { time: '14:29:55', level: 'danger',  msg: 'Redis 连接超时，已触发重连机制' },
  { time: '14:28:11', level: 'info',    msg: '缓存预热完成，命中率提升至 94.3%' },
  { time: '14:27:03', level: 'warning', msg: '第三方短信服务响应慢，P99 > 2s' },
]

// ── GridItem 容器 ──────────────────────────────────────────────────────
function GridItem({ title, isEditing, children }) {
  return (
    <div style={{ height: '100%', background: 'var(--semi-color-bg-1)', borderRadius: 10, overflow: 'hidden', border: isEditing ? `1.5px dashed ${DOM.blue}` : `1px solid ${DOM.border}`, boxShadow: '0 1px 3px rgba(15,23,42,0.06)', display: 'flex', flexDirection: 'column' }}>
      {/* 标题栏 */}
      <div
        className={isEditing ? 'drag-handle' : undefined}
        style={{
          background: 'var(--semi-color-bg-0)',
          borderBottom: `1px solid ${DOM.border}`,
          padding: '0 12px',
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          cursor: isEditing ? 'move' : 'default',
          userSelect: 'none',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13, color: DOM.text0 }}>{title}</span>
        {isEditing && (
          <span style={{ color: DOM.text2, fontSize: 16, lineHeight: 1 }}>⠿</span>
        )}
      </div>
      {/* 内容区 */}
      <div style={{ flex: 1, overflow: 'hidden', padding: 8 }}>
        {children}
      </div>
    </div>
  )
}

// ── 组件内容 ──────────────────────────────────────────────────────────
function LineChartWidget() {
  return <ReactECharts option={LINE_OPTION} style={{ height: '100%', width: '100%' }} />
}

function PieChartWidget() {
  return <ReactECharts option={PIE_OPTION} style={{ height: '100%', width: '100%' }} />
}

function StatCardsWidget() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, height: '100%', padding: '0 4px' }}>
      {STAT_DATA.map(s => (
        <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--semi-color-fill-0)', borderRadius: 8 }}>
          <span style={{ fontSize: 12, color: DOM.text2 }}>{s.label}</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</span>
        </div>
      ))}
    </div>
  )
}

function DataTableWidget() {
  return (
    <Table
      columns={TABLE_COLUMNS}
      dataSource={TABLE_DATA}
      size="small"
      pagination={false}
      style={{ height: '100%' }}
      scroll={{ y: '100%' }}
    />
  )
}

function ProgressWidget() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10, height: '100%', padding: '0 4px' }}>
      {PROGRESS_DATA.map(p => (
        <div key={p.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 11, color: DOM.text1 }}>{p.label}</span>
            <span style={{ fontSize: 11, color: DOM.text2 }}>{p.value}%</span>
          </div>
          <Progress percent={p.value} stroke={p.color} size="small" showInfo={false} />
        </div>
      ))}
    </div>
  )
}

function SysLogWidget() {
  return (
    <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {LOG_DATA.map((log, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 2px', borderBottom: `1px solid ${DOM.border}` }}>
          <span style={{ fontSize: 10, color: DOM.text2, whiteSpace: 'nowrap', lineHeight: '18px' }}>{log.time}</span>
          <Tag
            color={log.level === 'success' ? 'green' : log.level === 'warning' ? 'orange' : log.level === 'danger' ? 'red' : 'blue'}
            size="small"
            style={{ flexShrink: 0 }}
          >
            {log.level === 'success' ? 'OK' : log.level === 'warning' ? 'WARN' : log.level === 'danger' ? 'ERR' : 'INFO'}
          </Tag>
          <span style={{ fontSize: 11, color: DOM.text1, lineHeight: '18px', wordBreak: 'break-all' }}>{log.msg}</span>
        </div>
      ))}
    </div>
  )
}

const WIDGET_MAP = {
  'line-chart':  { title: '折线图 · 月度销售',  Component: LineChartWidget },
  'pie-chart':   { title: '饼图 · 市场份额',    Component: PieChartWidget },
  'stat-cards':  { title: '数字卡 · 核心指标',  Component: StatCardsWidget },
  'data-table':  { title: '数据表格 · 订单列表', Component: DataTableWidget },
  'progress':    { title: '进度条 · 部门完成率', Component: ProgressWidget },
  'sys-log':     { title: '系统日志',            Component: SysLogWidget },
}

// ── 主页面 ──────────────────────────────────────────────────────────
export default function DragLayoutPage() {
  const isMobile = useIsMobile()
  const containerRef = useRef(null)
  const [containerWidth, setContainerWidth] = useState(1200)
  const [isEditing, setIsEditing] = useState(false)
  const [layout, setLayout] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : DEFAULT_LAYOUT
    } catch {
      return DEFAULT_LAYOUT
    }
  })

  // 监听容器宽度
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect?.width
      if (w) setContainerWidth(w)
    })
    ro.observe(el)
    setContainerWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const handleLayoutChange = (newLayout) => {
    setLayout(newLayout)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newLayout))
    } catch { /* ignore */ }
  }

  const handleReset = () => {
    setLayout(DEFAULT_LAYOUT)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch { /* ignore */ }
  }

  return (
    <div>
      {/* 页面头部 */}
      <div style={{ ...CARD_STYLE, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <Title heading={4} style={{ margin: 0, color: DOM.text0 }}>拖拽布局</Title>
            <Text style={{ color: DOM.text2, fontSize: 13, marginTop: 2, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              基于 react-grid-layout 的响应式拖拽网格，支持自由拖拽、调整大小、布局持久化
            </Text>
          </div>
          <Space>
            <Button
              icon={isEditing ? <IconLock /> : <IconUnlock />}
              type={isEditing ? 'primary' : 'tertiary'}
              onClick={() => setIsEditing(v => !v)}
            >
              {isEditing ? '锁定布局' : '编辑布局'}
            </Button>
            <Button icon={<IconRefresh />} type="tertiary" onClick={handleReset}>
              重置布局
            </Button>
          </Space>
        </div>
        {isEditing && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--semi-color-primary-light-default)', borderRadius: 6, border: '1px solid var(--semi-color-primary-light-hover)' }}>
            <Text style={{ fontSize: 12, color: DOM.blue }}>
              编辑模式已开启 · 拖拽卡片标题栏移动位置，拖拽卡片右下角调整大小，布局会自动保存至本地
            </Text>
          </div>
        )}
      </div>

      {/* Grid 区域 */}
      <div style={{ overflowX: isMobile ? 'auto' : 'visible' }}>
      <div ref={containerRef}>
        <GridLayout
          className="layout"
          layout={layout}
          cols={12}
          rowHeight={80}
          width={containerWidth}
          isDraggable={isEditing}
          isResizable={isEditing}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".drag-handle"
          margin={[12, 12]}
          containerPadding={[0, 0]}
        >
          {layout.map(({ i }) => {
            const meta = WIDGET_MAP[i]
            if (!meta) return null
            const { title, Component } = meta
            return (
              <div key={i} className="grid-item">
                <GridItem title={title} isEditing={isEditing}>
                  <Component />
                </GridItem>
              </div>
            )
          })}
        </GridLayout>
      </div>
      </div>
    </div>
  )
}
