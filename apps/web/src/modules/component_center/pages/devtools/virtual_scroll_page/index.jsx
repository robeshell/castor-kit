import { CARD_STYLE } from '@/shared/styles'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { List, useListRef } from 'react-window'
import { Button, Input, InputNumber, Tag, Typography } from '@douyinfe/semi-ui'
import { IconSearch, IconArrowRight } from '@douyinfe/semi-icons'

const { Title, Text } = Typography

// ── 样式常量 ──────────────────────────────────────────────────────────

const C = {
  blue: '#4080FF', green: '#00B96B', orange: '#FA8C16',
  purple: '#9254DE', red: '#FF4D4F', cyan: '#13C2C2',
  border: 'var(--semi-color-border)',
  text0: 'var(--semi-color-text-0)',
  text1: 'var(--semi-color-text-1)',
  text2: 'var(--semi-color-text-2)',
}

// 列宽配置
const COL_WIDTHS = ['80px', '160px', '100px', '80px', '120px', '90px', '120px']
const COL_HEADERS = ['ID', '姓名', '部门', '级别', '薪资', '状态', '入职日期']

// 状态 Tag 配置
const STATUS_COLOR = {
  '在职':  'green',
  '试用期': 'orange',
  '离职':  'red',
  '休假':  'blue',
}

// ── 数据生成（带计时）────────────────────────────────────────────────
function generateData() {
  const t0 = performance.now()
  const depts = ['研发部', '产品部', '市场部', '运营部', '财务部', '人事部']
  const levels = ['P4', 'P5', 'P6', 'P7', 'P8']
  const statuses = ['在职', '试用期', '离职', '休假']
  const data = []
  for (let i = 0; i < 100000; i++) {
    data.push({
      id: i + 1,
      name: `员工_${String(i + 1).padStart(6, '0')}`,
      dept: depts[i % depts.length],
      level: levels[i % levels.length],
      salary: Math.floor(10000 + (i % 50) * 1000 + Math.sin(i) * 5000),
      status: statuses[i % statuses.length],
      joinDate: `202${i % 4}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
    })
  }
  const elapsed = (performance.now() - t0).toFixed(1)
  return { data, elapsed }
}

// ── 表头组件（固定）──────────────────────────────────────────────────
function TableHeader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      height: 40,
      background: 'var(--semi-color-bg-0)',
      borderBottom: `1px solid ${C.border}`,
      borderTop: `1px solid ${C.border}`,
      padding: '0 16px',
      fontWeight: 600,
      fontSize: 13,
      color: C.text1,
      flexShrink: 0,
    }}>
      {COL_HEADERS.map((h, idx) => (
        <div key={h} style={{ width: COL_WIDTHS[idx], flexShrink: 0 }}>{h}</div>
      ))}
    </div>
  )
}

// ── 行渲染组件（react-window v2 API）──────────────────────────────────
// react-window v2 List spreads rowProps directly into rowComponent props
function RowComponent({ index, style, ariaAttributes, itemData }) {
  const [hovered, setHovered] = useState(false)
  const data = itemData
  if (!data) return null
  const row = data[index]
  if (!row) return null
  const isEven = index % 2 === 0
  const salaryStr = `¥${row.salary.toLocaleString()}`

  return (
    <div
      {...ariaAttributes}
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        background: hovered ? 'rgba(64,128,255,0.06)' : isEven ? 'var(--semi-color-bg-1)' : 'var(--semi-color-fill-0)',
        borderBottom: `1px solid ${C.border}`,
        cursor: 'default',
        transition: 'background 0.1s',
        boxSizing: 'border-box',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ width: COL_WIDTHS[0], flexShrink: 0, color: C.text2, fontSize: 12 }}>{row.id}</div>
      <div style={{ width: COL_WIDTHS[1], flexShrink: 0, color: C.text0, fontWeight: 500, fontSize: 13 }}>{row.name}</div>
      <div style={{ width: COL_WIDTHS[2], flexShrink: 0, color: C.text1, fontSize: 13 }}>{row.dept}</div>
      <div style={{ width: COL_WIDTHS[3], flexShrink: 0 }}>
        <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: 'rgba(146,84,222,0.1)', color: C.purple }}>
          {row.level}
        </span>
      </div>
      <div style={{ width: COL_WIDTHS[4], flexShrink: 0, color: C.green, fontWeight: 600, fontSize: 13 }}>{salaryStr}</div>
      <div style={{ width: COL_WIDTHS[5], flexShrink: 0 }}>
        <Tag color={STATUS_COLOR[row.status] || 'grey'} size="small">{row.status}</Tag>
      </div>
      <div style={{ width: COL_WIDTHS[6], flexShrink: 0, color: C.text2, fontSize: 12 }}>{row.joinDate}</div>
    </div>
  )
}

// ── 性能指标卡片 ──────────────────────────────────────────────────────
function MetricCard({ label, value, desc, color }) {
  return (
    <div style={{
      ...CARD_STYLE,
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      borderLeft: `4px solid ${color}`,
      padding: '14px 18px',
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.text0 }}>{label}</div>
      {desc && <div style={{ fontSize: 12, color: C.text2 }}>{desc}</div>}
    </div>
  )
}

// ── debounce hook ─────────────────────────────────────────────────────
function useDebounce(initialValue, delay) {
  const [debounced, setDebounced] = useState(initialValue)
  const timerRef = useRef(null)
  const update = useCallback((v) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setDebounced(v), delay)
  }, [delay])
  // 卸载时清除待触发的定时器，避免对已卸载组件 setState
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])
  return [debounced, update]
}

// ── 主页面 ────────────────────────────────────────────────────────────
export default function VirtualScrollPage() {
  const isMobile = useIsMobile()
  // 生成数据（只执行一次）
  const { data: ALL_DATA, elapsed } = useMemo(() => generateData(), [])

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useDebounce('', 300)
  const [jumpIndex, setJumpIndex] = useState(1)
  const listRef = useListRef()

  const handleSearchChange = (val) => {
    setSearchInput(val)
    setDebouncedSearch(val)
  }

  // 过滤数据
  const filteredData = useMemo(() => {
    if (!debouncedSearch.trim()) return ALL_DATA
    const kw = debouncedSearch.toLowerCase()
    return ALL_DATA.filter(r =>
      r.name.toLowerCase().includes(kw) || r.dept.toLowerCase().includes(kw)
    )
  }, [ALL_DATA, debouncedSearch])

  const handleJump = () => {
    const idx = Math.max(0, Math.min(jumpIndex - 1, filteredData.length - 1))
    listRef.current?.scrollToRow({ index: idx, align: 'start' })
  }

  return (
    <div>
      {/* 页面头部 */}
      <div style={{ ...CARD_STYLE, marginBottom: 16 }}>
        <Title heading={4} style={{ margin: 0, color: C.text0 }}>虚拟滚动列表</Title>
        <Text style={{ color: C.text2, fontSize: 13, marginTop: 4, display: 'block' }}>
          基于 react-window 的高性能虚拟滚动，轻松渲染 10 万条数据
        </Text>
      </div>

      {/* 性能指标卡片 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <MetricCard
          label="总数据量"
          value="100,000 条"
          desc="完整员工数据集，一次性生成"
          color={C.blue}
        />
        <MetricCard
          label="实际 DOM 节点"
          value="~15 个"
          desc="react-window 仅渲染可视区行"
          color={C.green}
        />
        <MetricCard
          label="数据生成耗时"
          value={`${elapsed} ms`}
          desc="useMemo 保证只生成一次"
          color={C.orange}
        />
      </div>

      {/* 列表主体 */}
      <div style={{ ...CARD_STYLE, padding: 0, overflow: 'hidden' }}>
        {/* 工具栏 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: `1px solid ${C.border}`,
          flexWrap: 'wrap',
          gap: 12,
        }}>
          {/* 搜索框 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Input
              prefix={<IconSearch style={{ color: C.text2 }} />}
              placeholder="搜索姓名或部门..."
              value={searchInput}
              onChange={handleSearchChange}
              style={{ width: isMobile ? '100%' : 240 }}
              showClear
            />
            <Text style={{ fontSize: 13, color: C.text2, whiteSpace: 'nowrap' }}>
              {debouncedSearch
                ? `匹配 ${filteredData.length.toLocaleString()} / ${ALL_DATA.length.toLocaleString()} 条`
                : `共 ${ALL_DATA.length.toLocaleString()} 条数据`
              }
            </Text>
          </div>

          {/* 跳转功能 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 13, color: C.text1, whiteSpace: 'nowrap' }}>跳转到第</Text>
            <InputNumber
              value={jumpIndex}
              onChange={val => setJumpIndex(val || 1)}
              min={1}
              max={filteredData.length}
              style={{ width: 100 }}
            />
            <Text style={{ fontSize: 13, color: C.text1 }}>行</Text>
            <Button
              icon={<IconArrowRight />}
              type="primary"
              onClick={handleJump}
              size="small"
            >
              跳转
            </Button>
          </div>
        </div>

        {/* 表头 + 虚拟滚动（移动端横向可滚动）*/}
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 750 }}>
            <TableHeader />
            {filteredData.length === 0 ? (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text2, fontSize: 14 }}>
                未找到匹配数据
              </div>
            ) : (
              <List
                listRef={listRef}
                rowComponent={RowComponent}
                rowCount={filteredData.length}
                rowHeight={48}
                rowProps={{ itemData: filteredData }}
                style={{ height: isMobile ? 360 : 500 }}
              />
            )}
          </div>
        </div>

        {/* 底部信息栏 */}
        <div style={{
          borderTop: `1px solid ${C.border}`,
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          background: 'var(--semi-color-fill-0)',
        }}>
          <Text style={{ fontSize: 12, color: C.text2 }}>
            虚拟滚动窗口高度 500px，每行高度 48px，可视区约 10~11 行
          </Text>
          <Text style={{ fontSize: 12, color: C.text2 }}>
            实际挂载 DOM 节点数量远少于总数据量，内存占用极低
          </Text>
        </div>
      </div>
    </div>
  )
}
