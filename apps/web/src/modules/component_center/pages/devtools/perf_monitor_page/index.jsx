import { useEffect, useRef, useState } from 'react'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { Progress, Table, Tag, Typography } from '@douyinfe/semi-ui'
import ReactECharts from 'echarts-for-react'
import request from '@/shared/api/request'

const CARD = {
  background: 'var(--semi-color-bg-1)', borderRadius: 10,
  boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 8px 24px rgba(15,23,42,0.06)',
}
const C = {
  blue: '#4080FF', green: '#00B96B', orange: '#FA8C16', red: '#FF4D4F', purple: '#9254DE',
  text2: 'var(--semi-color-text-2)',
  border: 'var(--semi-color-border)',
}

const RESOURCE_COLUMNS = [
  {
    title: '资源',
    dataIndex: 'name',
    render: (v) => (
      <Typography.Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 200, display: 'inline-block' }}>
        {v || '—'}
      </Typography.Text>
    ),
  },
  { title: '类型', dataIndex: 'type', width: 70, render: (v) => <Tag color="blue" size="small">{v}</Tag> },
  {
    title: '耗时',
    dataIndex: 'duration',
    width: 80,
    render: (v) => (
      <span style={{ fontWeight: 600, color: v > 500 ? C.red : v > 200 ? C.orange : C.green }}>
        {v}ms
      </span>
    ),
  },
  { title: '大小', dataIndex: 'size', width: 70, render: (v) => (v != null ? `${v}KB` : '—') },
]

const MAX_PTS = 60

function colorFor(pct) {
  return pct < 50 ? C.green : pct < 80 ? C.orange : C.red
}

function GaugeCard({ label, value, pct, unit, desc, color }) {
  const c = color ?? colorFor(pct)
  return (
    <div style={{ ...CARD, padding: '14px 18px', flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <Typography.Text strong style={{ fontSize: 13 }}>{label}</Typography.Text>
        <span style={{ fontSize: 20, fontWeight: 700, color: c }}>{value}<span style={{ fontSize: 12, fontWeight: 400, marginLeft: 2 }}>{unit}</span></span>
      </div>
      <Progress percent={pct} stroke={c} showInfo={false} style={{ marginBottom: 6 }} />
      {desc && <Typography.Text type="tertiary" style={{ fontSize: 12 }}>{desc}</Typography.Text>}
    </div>
  )
}

function sparkOption(data, color) {
  return {
    backgroundColor: 'transparent',
    grid: { top: 4, left: 36, right: 8, bottom: 20 },
    xAxis: { type: 'category', data: data.map((_, i) => i), show: false },
    yAxis: { type: 'value', min: 0, max: 100, axisLabel: { fontSize: 10, color: C.text2 }, splitLine: { lineStyle: { color: 'rgba(128,128,128,0.12)' } } },
    series: [{
      type: 'line', data, smooth: true, symbol: 'none',
      lineStyle: { color, width: 1.5 },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: color + '55' }, { offset: 1, color: color + '00' }] } },
    }],
    tooltip: { trigger: 'axis', formatter: p => `${p[0].value.toFixed(1)}%` },
  }
}

export default function PerfMonitorPage() {
  const isMobile = useIsMobile()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [history, setHistory] = useState({ cpu: [], mem: [], disk: [] })
  const [navTiming, setNavTiming] = useState(null)
  const [resources, setResources] = useState([])
  const [fps, setFps] = useState(60)
  const fpsCounter = useRef(0)
  const fpsLast    = useRef(performance.now())
  const rafRef     = useRef(null)

  // FPS 计数
  useEffect(() => {
    const loop = (now) => {
      fpsCounter.current++
      if (now - fpsLast.current >= 1000) {
        setFps(Math.round(fpsCounter.current / (now - fpsLast.current) * 1000))
        fpsCounter.current = 0
        fpsLast.current = now
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // Navigation Timing（一次性）
  useEffect(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    if (nav && nav.loadEventEnd > 0) {
      setNavTiming({
        dns:      +(nav.domainLookupEnd  - nav.domainLookupStart).toFixed(0),
        tcp:      +(nav.connectEnd       - nav.connectStart).toFixed(0),
        ttfb:     +(nav.responseStart    - nav.requestStart).toFixed(0),
        download: +(nav.responseEnd      - nav.responseStart).toFixed(0),
        domParse: +(nav.domInteractive   - nav.responseEnd).toFixed(0),
        domReady: +(nav.domContentLoadedEventEnd - nav.fetchStart).toFixed(0),
        total:    +(nav.loadEventEnd     - nav.fetchStart).toFixed(0),
      })
    }
    const res = performance.getEntriesByType('resource')
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 8)
      .map(r => ({
        name: r.name.split('/').pop().split('?')[0].slice(0, 36) || r.name.slice(0, 36),
        type: r.initiatorType,
        duration: +r.duration.toFixed(0),
        size: r.transferSize ? +(r.transferSize / 1024).toFixed(1) : null,
      }))
    setResources(res)
  }, [])

  // 轮询后端性能数据
  useEffect(() => {
    let active = true
    const poll = async () => {
      try {
        const d = await request.get('/admin/component-center/devtools/perf-stats')
        if (!active) return
        setData(d)
        setError(null)
        setHistory(prev => ({
          cpu:  [...prev.cpu.slice(-(MAX_PTS - 1)),  d.cpu],
          mem:  [...prev.mem.slice(-(MAX_PTS - 1)),  d.mem_pct],
          disk: [...prev.disk.slice(-(MAX_PTS - 1)), d.disk_pct],
        }))
      } catch (e) {
        if (active) setError('无法连接后端，请确认 pnpm dev（端口 5001）已启动')
      }
    }
    poll()
    const timer = setInterval(poll, 1000)
    return () => { active = false; clearInterval(timer) }
  }, [])

  const fpsColor = fps >= 55 ? C.green : fps >= 30 ? C.orange : C.red

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 4 }}>
        <div>
          <Typography.Title heading={4} style={{ margin: 0 }}>性能监控面板</Typography.Title>
          <Typography.Text type="tertiary" style={{ fontSize: 13 }}>
            后端 systeminformation 实时采集 · 前端 Navigation Timing API · 每秒刷新
          </Typography.Text>
        </div>
        {data && (
          <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
            {new Date(data.ts).toLocaleTimeString('zh', { hour12: false })} 更新
          </Typography.Text>
        )}
      </div>

      {error && (
        <div style={{ ...CARD, padding: '12px 16px', marginBottom: 16, color: C.red, fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {/* 指标卡 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', minWidth: 0 }}>
        <GaugeCard label="CPU 使用率" value={data?.cpu ?? '—'} pct={data?.cpu ?? 0} unit="%" desc={data ? `${data.cpu < 40 ? '负载低' : data.cpu < 70 ? '负载中' : '负载高'}` : '等待数据'} />
        <GaugeCard label="内存使用" value={data ? `${data.mem_used.toFixed(0)}` : '—'} pct={data?.mem_pct ?? 0} unit="MB" desc={data ? `${data.mem_used.toFixed(0)} / ${data.mem_total.toFixed(0)} MB (${data.mem_pct}%)` : '等待数据'} />
        <GaugeCard label="磁盘使用" value={data ? `${data.disk_used.toFixed(1)}` : '—'} pct={data?.disk_pct ?? 0} unit="GB" desc={data ? `${data.disk_used.toFixed(1)} / ${data.disk_total.toFixed(1)} GB (${data.disk_pct}%)` : '等待数据'} />
        <GaugeCard label="页面帧率" value={fps} pct={(fps / 120) * 100} unit="fps" color={fpsColor} desc={fps >= 55 ? '流畅' : fps >= 30 ? '轻微卡顿' : '卡顿'} />
      </div>

      {/* 历史折线 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'CPU %', data: history.cpu, color: colorFor(data?.cpu ?? 0) },
          { label: '内存 %', data: history.mem, color: colorFor(data?.mem_pct ?? 0) },
          { label: '磁盘 %', data: history.disk, color: colorFor(data?.disk_pct ?? 0) },
        ].map(({ label, data: d, color }) => (
          <div key={label} style={{ ...CARD, flex: 1, padding: '12px 16px' }}>
            <Typography.Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{label} (60s)</Typography.Text>
            <ReactECharts option={sparkOption(d, color)} style={{ height: 80 }} opts={{ renderer: 'canvas' }} />
          </div>
        ))}
      </div>

      {/* 网络 + Navigation Timing + 资源 */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '200px 320px 1fr', gap: 12 }}>
        {/* 网络 IO */}
        <div style={{ ...CARD, padding: '14px 16px' }}>
          <Typography.Text strong style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>网络 IO（累计）</Typography.Text>
          {[
            { label: '发送', value: data ? `${data.net_sent} MB` : '—', color: C.blue },
            { label: '接收', value: data ? `${data.net_recv} MB` : '—', color: C.green },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ marginBottom: 10 }}>
              <Typography.Text type="tertiary" style={{ fontSize: 12 }}>{label}</Typography.Text>
              <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Navigation Timing */}
        <div style={{ ...CARD, padding: '14px 16px' }}>
          <Typography.Text strong style={{ display: 'block', marginBottom: 10, fontSize: 13 }}>页面加载时序</Typography.Text>
          {navTiming ? (
            [
              { label: 'DNS',            val: navTiming.dns,      color: C.purple },
              { label: 'TCP',            val: navTiming.tcp,      color: C.blue },
              { label: 'TTFB',           val: navTiming.ttfb,     color: C.orange },
              { label: '下载',           val: navTiming.download, color: C.green },
              { label: 'DOM 解析',       val: navTiming.domParse, color: C.blue },
              { label: 'DOMContentLoaded', val: navTiming.domReady, color: C.orange },
              { label: '总耗时',         val: navTiming.total,    color: C.red },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                <span style={{ fontSize: 12, color: C.text2, width: 100, flexShrink: 0 }}>{label}</span>
                <div style={{ flex: 1, background: 'var(--semi-color-fill-1)', borderRadius: 3, height: 5, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, (val / navTiming.total) * 100)}%`, height: '100%', background: color, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color, width: 48, textAlign: 'right' }}>{val}ms</span>
              </div>
            ))
          ) : (
            <Typography.Text type="tertiary" style={{ fontSize: 13 }}>加载完成后可用</Typography.Text>
          )}
        </div>

        {/* 资源耗时 */}
        <div style={{ ...CARD, padding: '14px 16px' }}>
          <Typography.Text strong style={{ display: 'block', marginBottom: 10, fontSize: 13 }}>最慢资源 Top 8</Typography.Text>
          <Table
            columns={RESOURCE_COLUMNS}
            dataSource={resources}
            rowKey="name"
            pagination={false}
            size="small"
            empty={<Typography.Text type="tertiary" style={{ fontSize: 13 }}>无资源记录</Typography.Text>}
          />
        </div>
      </div>
    </div>
  )
}
