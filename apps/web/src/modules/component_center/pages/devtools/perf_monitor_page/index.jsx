import { memo, useEffect, useMemo, useRef, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { motion } from 'motion/react'
import { AlertTriangle, ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { chartBase, hexToRgba, useChartColors } from '@/lib/chart-theme'
import { cn } from '@/lib/utils'
import DataTable from '@/shared/components/DataTable'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'
import StatusBadge from '@/shared/components/StatusBadge'
import request from '@/shared/api/request'

const MAX_PTS = 60

// Usage levels: <50 normal / <80 high / otherwise alert
function levelFor(pct) {
  return pct < 50 ? 'success' : pct < 80 ? 'warning' : 'danger'
}
const LEVEL_TEXT = { success: 'text-success', warning: 'text-warning', danger: 'text-danger' }
const LEVEL_BAR = { success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger' }

const RESOURCE_COLUMNS = [
  {
    key: 'name',
    title: '资源',
    dataIndex: 'name',
    render: (v, row) => (
      <span className="block max-w-[260px] truncate font-mono text-xs" title={row.fullName}>
        {v || '—'}
      </span>
    ),
  },
  { key: 'type', title: '类型', dataIndex: 'type', width: 90, render: (v) => <StatusBadge tone="info">{v}</StatusBadge> },
  {
    key: 'duration',
    title: '耗时',
    dataIndex: 'duration',
    width: 90,
    align: 'right',
    render: (v) => (
      <span className={cn('font-medium tabular-nums', v > 500 ? 'text-danger' : v > 200 ? 'text-warning' : 'text-success')}>
        {v}ms
      </span>
    ),
  },
  {
    key: 'size',
    title: '大小',
    dataIndex: 'size',
    width: 90,
    align: 'right',
    render: (v) => <span className="text-muted-foreground tabular-nums">{v != null ? `${v}KB` : '—'}</span>,
  },
]

const TIMING_ROWS = [
  { key: 'dns', label: 'DNS', bar: 'bg-chart-4' },
  { key: 'tcp', label: 'TCP', bar: 'bg-chart-1' },
  { key: 'ttfb', label: 'TTFB', bar: 'bg-chart-5' },
  { key: 'download', label: '下载', bar: 'bg-chart-3' },
  { key: 'domParse', label: 'DOM 解析', bar: 'bg-chart-2' },
  { key: 'domReady', label: 'DOMContentLoaded', bar: 'bg-chart-1' },
  { key: 'total', label: '总耗时', bar: 'bg-brand-gradient' },
]

function readNavTiming() {
  const nav = performance.getEntriesByType('navigation')[0]
  if (!nav || nav.loadEventEnd <= 0) return null
  return {
    dns: +(nav.domainLookupEnd - nav.domainLookupStart).toFixed(0),
    tcp: +(nav.connectEnd - nav.connectStart).toFixed(0),
    ttfb: +(nav.responseStart - nav.requestStart).toFixed(0),
    download: +(nav.responseEnd - nav.responseStart).toFixed(0),
    domParse: +(nav.domInteractive - nav.responseEnd).toFixed(0),
    domReady: +(nav.domContentLoadedEventEnd - nav.fetchStart).toFixed(0),
    total: +(nav.loadEventEnd - nav.fetchStart).toFixed(0),
  }
}

function readResources() {
  return (
    performance
      .getEntriesByType('resource')
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 8)
      // Truncated file names can repeat (e.g. several index.js), so the index is the row key to avoid React duplicate-key warnings
      .map((r, i) => ({
        id: i,
        fullName: r.name,
        name: r.name.split('/').pop().split('?')[0].slice(0, 36) || r.name.slice(0, 36),
        type: r.initiatorType,
        duration: +r.duration.toFixed(0),
        size: r.transferSize ? +(r.transferSize / 1024).toFixed(1) : null,
      }))
  )
}

function GaugeCard({ label, value, pct, unit, desc, level }) {
  const clamped = Math.max(0, Math.min(100, pct || 0))
  return (
    <div className="surface-card flex flex-col gap-3 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground text-[13px]">{label}</span>
        <span className={cn('flex items-baseline gap-0.5', LEVEL_TEXT[level])}>
          <span className="text-[22px] leading-none font-semibold tracking-tight tabular-nums">{value}</span>
          <span className="text-xs">{unit}</span>
        </span>
      </div>
      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
        {/* Values refresh every second, so a CSS transition is enough; no rAF needed */}
        <div
          className={cn('h-full rounded-full transition-[width,background-color] duration-500 ease-out', LEVEL_BAR[level])}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {desc ? <span className="text-muted-foreground text-xs">{desc}</span> : null}
    </div>
  )
}

// memo: keep the per-second FPS update from re-rendering the charts
const HistoryChart = memo(function HistoryChart({ label, data, level, c }) {
  const { t } = useTranslation()
  const option = useMemo(() => {
    const base = chartBase(c)
    const color = c[level] || c['brand-from']
    return {
      ...base,
      grid: { top: 6, left: 4, right: 8, bottom: 4, containLabel: true },
      xAxis: { ...base.xAxis, type: 'category', data: data.map((_, i) => i), show: false },
      yAxis: { ...base.yAxis, type: 'value', min: 0, max: 100, splitNumber: 2, axisLabel: { ...base.yAxis.axisLabel, fontSize: 10 } },
      series: [
        {
          type: 'line',
          data,
          smooth: true,
          symbol: 'none',
          lineStyle: { color, width: 1.6 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: hexToRgba(color, 0.3) },
                { offset: 1, color: hexToRgba(color, 0) },
              ],
            },
          },
        },
      ],
      tooltip: { ...base.tooltip, formatter: (p) => `${Number(p[0].value).toFixed(1)}%` },
      animation: false,
    }
  }, [c, data, level])
  return (
    <Panel title={`${t(label)} (60s)`} bodyClassName="pt-0">
      {/* Mount the chart only after the first data point to avoid an echarts-for-react race with repeated setOption during init */}
      {data.length ? (
        <ReactECharts option={option} style={{ height: 96 }} opts={{ renderer: 'canvas' }} />
      ) : (
        <Skeleton className="h-24 w-full" />
      )}
    </Panel>
  )
})

export default function PerfMonitorPage() {
  const { t } = useTranslation()
  const c = useChartColors()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [history, setHistory] = useState({ cpu: [], mem: [], disk: [] })
  // Navigation Timing / resource timings: read once on page entry
  const [navTiming] = useState(readNavTiming)
  const [resources] = useState(readResources)
  const [fps, setFps] = useState(60)
  const fpsCounter = useRef(0)
  const fpsLast = useRef(0)
  const rafRef = useRef(null)

  // FPS counter
  useEffect(() => {
    fpsLast.current = performance.now()
    const loop = (now) => {
      fpsCounter.current++
      if (now - fpsLast.current >= 1000) {
        setFps(Math.round((fpsCounter.current / (now - fpsLast.current)) * 1000))
        fpsCounter.current = 0
        fpsLast.current = now
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // Poll backend performance data
  useEffect(() => {
    let active = true
    const poll = async () => {
      try {
        const d = await request.get('/admin/component-center/devtools/perf-stats')
        if (!active) return
        setData(d)
        setError(null)
        setHistory((prev) => ({
          cpu: [...prev.cpu.slice(-(MAX_PTS - 1)), d.cpu],
          mem: [...prev.mem.slice(-(MAX_PTS - 1)), d.mem_pct],
          disk: [...prev.disk.slice(-(MAX_PTS - 1)), d.disk_pct],
        }))
      } catch {
        if (active) setError('无法连接后端，请确认 pnpm dev（端口 5001）已启动')
      }
    }
    poll()
    const timer = setInterval(poll, 1000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  const fpsLevel = fps >= 55 ? 'success' : fps >= 30 ? 'warning' : 'danger'

  return (
    <div className="space-y-5">
      <PageHeader
        title="性能监控面板"
        actions={
          data ? (
            <StatusBadge tone="success" variant="plain" dot>
              <span className="tabular-nums">{new Date(data.ts).toLocaleTimeString('zh', { hour12: false })}</span> {t('更新')}
            </StatusBadge>
          ) : null
        }
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>{t(error)}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GaugeCard
          label={t('CPU 使用率')}
          value={data?.cpu ?? '—'}
          pct={data?.cpu ?? 0}
          unit="%"
          level={levelFor(data?.cpu ?? 0)}
          desc={t(data ? (data.cpu < 40 ? '负载低' : data.cpu < 70 ? '负载中' : '负载高') : '等待数据')}
        />
        <GaugeCard
          label={t('内存使用')}
          value={data ? data.mem_used.toFixed(0) : '—'}
          pct={data?.mem_pct ?? 0}
          unit="MB"
          level={levelFor(data?.mem_pct ?? 0)}
          desc={data ? `${data.mem_used.toFixed(0)} / ${data.mem_total.toFixed(0)} MB (${data.mem_pct}%)` : t('等待数据')}
        />
        <GaugeCard
          label={t('磁盘使用')}
          value={data ? data.disk_used.toFixed(1) : '—'}
          pct={data?.disk_pct ?? 0}
          unit="GB"
          level={levelFor(data?.disk_pct ?? 0)}
          desc={data ? `${data.disk_used.toFixed(1)} / ${data.disk_total.toFixed(1)} GB (${data.disk_pct}%)` : t('等待数据')}
        />
        <GaugeCard
          label={t('页面帧率')}
          value={fps}
          pct={(fps / 120) * 100}
          unit="fps"
          level={fpsLevel}
          desc={t(fps >= 55 ? '流畅' : fps >= 30 ? '轻微卡顿' : '卡顿')}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <HistoryChart label="CPU %" data={history.cpu} level={levelFor(data?.cpu ?? 0)} c={c} />
        <HistoryChart label="内存 %" data={history.mem} level={levelFor(data?.mem_pct ?? 0)} c={c} />
        <HistoryChart label="磁盘 %" data={history.disk} level={levelFor(data?.disk_pct ?? 0)} c={c} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_340px_minmax(0,1fr)]">
        <Panel title="网络 IO（累计）">
          <div className="space-y-2">
            {[
              { label: '发送', value: data ? `${data.net_sent} MB` : '—', icon: ArrowUpRight },
              { label: '接收', value: data ? `${data.net_recv} MB` : '—', icon: ArrowDownRight },
            ].map((item) => (
              <div key={item.label} className="bg-muted/50 rounded-lg px-3 py-2.5">
                <div className="text-muted-foreground flex items-center gap-1 text-[11px]">
                  <item.icon className="size-3" />
                  {t(item.label)}
                </div>
                <div className="mt-1 font-mono text-base font-medium tabular-nums">{item.value}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="页面加载时序">
          {navTiming ? (
            <div className="space-y-2.5">
              {TIMING_ROWS.map((row) => {
                const val = navTiming[row.key]
                const pct = navTiming.total > 0 ? Math.min(100, (val / navTiming.total) * 100) : 0
                return (
                  <div key={row.key} className="grid grid-cols-[112px_minmax(0,1fr)_52px] items-center gap-2 text-xs">
                    <span className="text-muted-foreground truncate">{t(row.label)}</span>
                    <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                      <motion.div
                        className={cn('h-full rounded-full', row.bar)}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
                      />
                    </div>
                    <span className="text-right font-mono font-medium tabular-nums">{val}ms</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-[13px]">{t('加载完成后可用')}</p>
          )}
        </Panel>

        <Panel title="最慢资源 Top 8" padded={false}>
          <DataTable
            data={resources}
            columns={RESOURCE_COLUMNS}
            rowKey="id"
            bordered={false}
            dense
            emptyTitle="无资源记录"
            className="border-t"
          />
        </Panel>
      </div>
    </div>
  )
}
