import { CARD_STYLE } from '@/shared/styles'
import { useState } from 'react'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import ReactECharts from 'echarts-for-react'
import { Button, Typography, Tag, Space } from '@douyinfe/semi-ui'
import { IconRefresh } from '@douyinfe/semi-icons'


const C = {
  blue: '#4080FF', green: '#00B96B', orange: '#FA8C16',
  purple: '#9254DE', red: '#FF4D4F', cyan: '#13C2C2',
}

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

// ── 散点热力图数据 ─────────────────────────────────────────────────────
function generateHourData() {
  const hours = ['0时', '1时', '2时', '3时', '4时', '5时', '6时', '7时', '8时', '9时',
    '10时', '11时', '12时', '13时', '14时', '15时', '16时', '17时', '18时', '19时',
    '20时', '21时', '22时', '23时']
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
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
  return { data, hours, days }
}

// ── 年度统计 ──────────────────────────────────────────────────────────
function calcStats(calData) {
  const total = calData.reduce((s, [, v]) => s + v, 0)
  const activeDays = calData.filter(([, v]) => v > 0).length
  const maxDay = calData.reduce((mx, d) => d[1] > mx[1] ? d : mx, ['', 0])
  const streak = (() => {
    let max = 0, cur = 0
    for (const [, v] of calData) { cur = v > 0 ? cur + 1 : 0; max = Math.max(max, cur) }
    return max
  })()
  return { total, activeDays, maxDay, streak }
}

export default function HeatmapPage() {
  const isMobile = useIsMobile()
  const [calData, setCalData] = useState(() => generateCalendarData())
  const [hourInfo, setHourInfo] = useState(() => generateHourData())

  const handleRefresh = () => {
    setCalData(generateCalendarData())
    setHourInfo(generateHourData())
  }

  const stats = calcStats(calData)
  const startDate = calData[0][0]
  const endDate = calData[calData.length - 1][0]

  // ── 日历热力图 option ─────────────────────────────────────────────
  const calOption = {
    backgroundColor: 'transparent',
    tooltip: {
      formatter: p => `${p.data[0]}<br/>活跃度：<b>${p.data[1]}</b>`,
    },
    visualMap: {
      min: 0,
      max: 18,
      show: false,
      inRange: {
        color: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
      },
    },
    calendar: {
      top: 30,
      left: 40,
      right: 20,
      cellSize: [14, 14],
      range: [startDate, endDate],
      itemStyle: { borderWidth: 2, borderColor: '#fff' },
      yearLabel: { show: false },
      dayLabel: {
        firstDay: 1,
        nameMap: ['日', '一', '二', '三', '四', '五', '六'],
        color: '#8c8c8c',
        fontSize: 11,
      },
      monthLabel: { color: '#8c8c8c', fontSize: 11 },
    },
    series: [{
      type: 'heatmap',
      coordinateSystem: 'calendar',
      data: calData,
    }],
  }

  // ── 时段×星期热力图 option ────────────────────────────────────────
  const { data: hourData, hours, days } = hourInfo
  const maxVal = Math.max(...hourData.map(d => d[2]), 1)
  const hourOption = {
    backgroundColor: 'transparent',
    tooltip: {
      position: 'top',
      formatter: p => `${days[p.data[1]]} ${hours[p.data[0]]}<br/>活跃度：<b>${p.data[2]}</b>`,
    },
    grid: { top: 10, left: 50, right: 60, bottom: 30 },
    xAxis: {
      type: 'category',
      data: hours,
      axisLabel: { fontSize: 10, interval: 1, color: '#8c8c8c' },
      splitArea: { show: true },
    },
    yAxis: {
      type: 'category',
      data: days,
      axisLabel: { fontSize: 12, color: '#434343' },
      splitArea: { show: true },
    },
    visualMap: {
      min: 0,
      max: maxVal,
      calculable: true,
      orient: 'vertical',
      right: 0,
      top: 'center',
      inRange: {
        color: ['#f0f9e8', '#bae4bc', '#7bccc4', '#43a2ca', '#0868ac'],
      },
      textStyle: { fontSize: 11, color: '#8c8c8c' },
    },
    series: [{
      name: '活跃度',
      type: 'heatmap',
      data: hourData,
      label: {
        show: false,
      },
      emphasis: {
        itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' },
      },
    }],
  }

  return (
    <div>
      {/* 页头 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <Typography.Title heading={4} style={{ margin: 0 }}>热力日历图</Typography.Title>
          <Typography.Text type="tertiary" style={{ fontSize: 13 }}>
            ECharts Calendar Heatmap · 活跃度全年可视化
          </Typography.Text>
        </div>
        <Button icon={<IconRefresh />} onClick={handleRefresh}>刷新数据</Button>
      </div>

      {/* 年度统计 */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: '年度总活跃', value: stats.total.toLocaleString(), color: C.green },
          { label: '活跃天数', value: `${stats.activeDays} 天`, color: C.blue },
          { label: '最长连续', value: `${stats.streak} 天`, color: C.orange },
          { label: '单日最高', value: stats.maxDay[1], color: C.purple },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            ...CARD_STYLE,
            borderTop: `3px solid ${color}`,
            padding: '12px 16px',
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* 年度日历热力图 */}
      <div style={{ ...CARD_STYLE, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Typography.Title heading={6} style={{ margin: 0 }}>年度活跃日历</Typography.Title>
          <Tag color="green" size="small">GitHub 贡献图风格</Tag>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: '#8c8c8c' }}>少</span>
          {['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'].map(c => (
            <div key={c} style={{ width: 12, height: 12, borderRadius: 2, background: c }} />
          ))}
          <span style={{ fontSize: 11, color: '#8c8c8c' }}>多</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <ReactECharts option={calOption} style={{ height: 160, minWidth: 600 }} opts={{ renderer: 'canvas' }} />
        </div>
      </div>

      {/* 时段×星期热力矩阵 */}
      <div style={CARD_STYLE}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Typography.Title heading={6} style={{ margin: 0 }}>全周活跃热力矩阵</Typography.Title>
          <Tag color="blue" size="small">24h × 7days</Tag>
        </div>
        <ReactECharts option={hourOption} style={{ height: 220 }} opts={{ renderer: 'canvas' }} />
      </div>
    </div>
  )
}
