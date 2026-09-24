import { useEffect, useRef, useState, useCallback } from 'react'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import ReactECharts from 'echarts-for-react'
import { Button, Space, Select, Tag, Typography, Card, Badge } from '@douyinfe/semi-ui'
import { IconPlay, IconPause, IconDelete, IconActivity } from '@douyinfe/semi-icons'

const MAX_POINTS = 60
const SERIES_CONFIG = [
  { key: 'temperature', name: '温度', unit: '°C', color: '#4d70e8', min: 20, max: 35 },
  { key: 'humidity', name: '湿度', unit: '%', color: '#19be6b', min: 40, max: 90 },
  { key: 'pressure', name: '压力', unit: 'kPa', color: '#ff9900', min: 100, max: 110 },
  { key: 'flow', name: '流量', unit: 'm³/h', color: '#c23531', min: 50, max: 200 },
]

const CARD_STYLE = {
  background: 'var(--semi-color-bg-1)',
  borderRadius: 8,
  padding: 16,
  marginBottom: 16,
  boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 18px rgba(15,23,42,0.06)',
}

function randomValue(min, max, prev) {
  const delta = (max - min) * 0.05
  const next = prev + (Math.random() - 0.5) * 2 * delta
  return Math.max(min, Math.min(max, next))
}

function formatTime(date) {
  return date.toTimeString().slice(0, 8)
}

export default function RealtimeChartPage() {
  const isMobile = useIsMobile()
  const [running, setRunning] = useState(true)
  const [speed, setSpeed] = useState('1x')
  const [timestamps, setTimestamps] = useState(() => {
    const now = new Date()
    return Array.from({ length: 10 }, (_, i) => {
      const d = new Date(now.getTime() - (9 - i) * 1000)
      return formatTime(d)
    })
  })
  const [series, setSeries] = useState(() => {
    const vals = {}
    SERIES_CONFIG.forEach(s => {
      vals[s.key] = Array.from({ length: 10 }, () =>
        +(s.min + Math.random() * (s.max - s.min)).toFixed(2)
      )
    })
    return vals
  })
  const [current, setCurrent] = useState(() => {
    const c = {}
    SERIES_CONFIG.forEach(s => { c[s.key] = +(s.min + Math.random() * (s.max - s.min)).toFixed(2) })
    return c
  })

  const prevRef = useRef({})
  useEffect(() => {
    SERIES_CONFIG.forEach(s => { prevRef.current[s.key] = current[s.key] })
  }, [])

  const speedMs = { '0.5x': 2000, '1x': 1000, '2x': 500 }

  const addPoint = useCallback(() => {
    const now = formatTime(new Date())
    const newVals = {}
    SERIES_CONFIG.forEach(s => {
      newVals[s.key] = +randomValue(s.min, s.max, prevRef.current[s.key] ?? (s.min + s.max) / 2).toFixed(2)
      prevRef.current[s.key] = newVals[s.key]
    })
    setTimestamps(prev => [...prev.slice(-(MAX_POINTS - 1)), now])
    setSeries(prev => {
      const next = {}
      SERIES_CONFIG.forEach(s => {
        next[s.key] = [...prev[s.key].slice(-(MAX_POINTS - 1)), newVals[s.key]]
      })
      return next
    })
    setCurrent(newVals)
  }, [])

  useEffect(() => {
    if (!running) return
    const ms = speedMs[speed] || 1000
    const timer = setInterval(addPoint, ms)
    return () => clearInterval(timer)
  }, [running, speed, addPoint])

  const handleClear = () => {
    setTimestamps([])
    setSeries(() => { const v = {}; SERIES_CONFIG.forEach(s => { v[s.key] = [] }); return v })
  }

  const option = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { data: SERIES_CONFIG.map(s => s.name), top: 8 },
    grid: { left: 60, right: 20, bottom: 40, top: 50 },
    xAxis: {
      type: 'category',
      data: timestamps,
      boundaryGap: false,
      axisLabel: { fontSize: 11, rotate: timestamps.length > 30 ? 30 : 0 },
    },
    yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed' } } },
    series: SERIES_CONFIG.map(s => ({
      name: s.name,
      type: 'line',
      data: series[s.key],
      smooth: true,
      symbol: 'none',
      lineStyle: { color: s.color, width: 2 },
      areaStyle: { color: s.color, opacity: 0.06 },
      itemStyle: { color: s.color },
    })),
    animation: false,
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <IconActivity size="large" style={{ color: '#4d70e8' }} />
          <Typography.Title heading={4} style={{ margin: 0 }}>实时折线图</Typography.Title>
          <Tag
            color={running ? 'green' : 'grey'}
            style={{ borderRadius: 20, fontWeight: 600 }}
          >
            {running ? '● LIVE' : '⏸ PAUSED'}
          </Tag>
        </div>
        <Space>
          <Select
            value={speed}
            onChange={setSpeed}
            style={{ width: 90 }}
            optionList={[
              { label: '0.5× 慢速', value: '0.5x' },
              { label: '1× 正常', value: '1x' },
              { label: '2× 快速', value: '2x' },
            ]}
          />
          <Button
            icon={running ? <IconPause /> : <IconPlay />}
            theme="solid"
            type={running ? 'warning' : 'primary'}
            onClick={() => setRunning(r => !r)}
          >
            {running ? '暂停' : '继续'}
          </Button>
          <Button icon={<IconDelete />} type="danger" onClick={handleClear}>清空</Button>
        </Space>
      </div>

      {/* Current value cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {SERIES_CONFIG.map(s => (
          <div key={s.key} style={{ ...CARD_STYLE, padding: 12, marginBottom: 0, borderLeft: `4px solid ${s.color}` }}>
            <Typography.Text type="tertiary" size="small">{s.name}</Typography.Text>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color, marginTop: 4 }}>
              {current[s.key] ?? '--'}
              <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 4, color: 'var(--semi-color-text-2)' }}>{s.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={CARD_STYLE}>
        <ReactECharts
          option={option}
          style={{ height: isMobile ? 220 : 400 }}
          opts={{ renderer: 'canvas' }}
          notMerge={false}
          lazyUpdate={true}
        />
      </div>

      <Typography.Text type="tertiary" size="small">
        已展示最近 {timestamps.length} 个数据点（最多 {MAX_POINTS} 个）· 数据由前端随机生成，模拟传感器采集
      </Typography.Text>
    </div>
  )
}
