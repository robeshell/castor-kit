import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { motion } from 'motion/react'
import { ArrowDown, ArrowUp, CircleCheck, CircleX, Plug, PlugZap, Radio, Send, Unplug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { brandArea, brandLine, chartBase, useChartColors } from '@/lib/chart-theme'
import { EASE_OUT } from '@/lib/motion'
import { cn } from '@/lib/utils'
import EmptyState from '@/shared/components/EmptyState'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'
import StatusBadge from '@/shared/components/StatusBadge'

const WS_URL = '/ws/devtools' // vite proxy → ws://localhost:5001/ws/devtools
const MAX_MSGS = 300
const MAX_PTS = 40

const STATUS_META = {
  idle: { tone: 'neutral', label: '未连接' },
  connecting: { tone: 'warning', label: '连接中...' },
  connected: { tone: 'success', label: '已连接' },
  error: { tone: 'danger', label: '连接错误' },
  closed: { tone: 'neutral', label: '已断开' },
}

// 系统消息的图标与颜色
const SYS_ICON = { ok: CircleCheck, error: CircleX, closed: Plug }
const SYS_CLASS = { ok: 'text-success', error: 'text-danger', closed: 'text-muted-foreground' }

function getWsUrl() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}${WS_URL}`
}

// 服务端消息为 JSON（type: metric / echo），解析失败时按纯文本展示
function messageType(text) {
  try {
    const obj = JSON.parse(text)
    return obj && typeof obj === 'object' && typeof obj.type === 'string' ? obj.type : null
  } catch {
    return null
  }
}

function MessageRow({ m }) {
  const SysIcon = m.dir === 'sys' ? SYS_ICON[m.kind] || Radio : null
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: EASE_OUT }}
      className={cn(
        'grid grid-cols-[64px_16px_minmax(0,1fr)] items-start gap-2 rounded-md px-2 py-1 font-mono text-xs',
        m.dir === 'out' && 'bg-brand-soft',
        m.dir === 'sys' && 'bg-muted/50',
      )}
    >
      <span className="text-muted-foreground pt-px text-[11px] tabular-nums">{m.ts}</span>
      <span className="flex h-[18px] items-center">
        {m.dir === 'in' ? (
          <ArrowDown className="text-success size-3" />
        ) : m.dir === 'out' ? (
          <ArrowUp className="text-primary size-3" />
        ) : (
          <SysIcon className={cn('size-3', SYS_CLASS[m.kind])} />
        )}
      </span>
      <span className="leading-[18px] break-all">
        {m.type ? (
          <StatusBadge tone={m.type === 'echo' ? 'brand' : 'neutral'} className="mr-1.5 h-4 px-1 align-[1px] text-[10px]">
            {m.type}
          </StatusBadge>
        ) : null}
        <span className={cn(m.dir === 'sys' && 'font-sans', m.dir === 'sys' && SYS_CLASS[m.kind])}>{m.text}</span>
      </span>
    </motion.div>
  )
}

export default function WebSocketPage() {
  const c = useChartColors()
  const [status, setStatus] = useState('idle')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [stats, setStats] = useState({ sent: 0, received: 0 })
  const [rateData, setRateData] = useState({ times: [], values: [] })

  const wsRef = useRef(null)
  const rateCounter = useRef(0)
  const rateTimer = useRef(null)
  const logRef = useRef(null)
  const seqRef = useRef(0)

  const addMsg = useCallback((text, dir, kind) => {
    seqRef.current += 1
    const id = seqRef.current
    setMessages((prev) => [
      ...prev.slice(-(MAX_MSGS - 1)),
      {
        id,
        text,
        dir,
        kind,
        type: dir === 'sys' ? null : messageType(text),
        ts: new Date().toLocaleTimeString('zh', { hour12: false }),
      },
    ])
    if (dir === 'in') rateCounter.current++
  }, [])

  const disconnect = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
    clearInterval(rateTimer.current)
    setStatus('idle')
  }, [])

  const connect = useCallback(() => {
    if (wsRef.current) return
    setStatus('connecting')
    setMessages([])
    setStats({ sent: 0, received: 0 })
    setRateData({ times: [], values: [] })
    rateCounter.current = 0

    const ws = new WebSocket(getWsUrl())
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('connected')
      addMsg('WebSocket 连接已建立（后端实时推送服务器指标）', 'sys', 'ok')
      rateTimer.current = setInterval(() => {
        const n = rateCounter.current
        rateCounter.current = 0
        setRateData((prev) => ({
          times: [...prev.times.slice(-(MAX_PTS - 1)), new Date().toLocaleTimeString('zh', { hour12: false })],
          values: [...prev.values.slice(-(MAX_PTS - 1)), n],
        }))
      }, 1000)
    }

    ws.onmessage = (e) => {
      addMsg(e.data, 'in')
      setStats((s) => ({ ...s, received: s.received + 1 }))
    }

    ws.onerror = () => {
      addMsg('连接错误，请确认后端已启动（pnpm dev，端口 5001）', 'sys', 'error')
      setStatus('error')
    }

    ws.onclose = (e) => {
      addMsg(`连接已关闭 (code: ${e.code})`, 'sys', 'closed')
      setStatus('closed')
      clearInterval(rateTimer.current)
      wsRef.current = null
    }
  }, [addMsg])

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text || status !== 'connected') return
    wsRef.current?.send(JSON.stringify({ text }))
    addMsg(text, 'out')
    setStats((s) => ({ ...s, sent: s.sent + 1 }))
    setInput('')
  }, [input, status, addMsg])

  // 新消息到达时平滑滚到底部
  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages])

  useEffect(
    () => () => {
      wsRef.current?.close()
      clearInterval(rateTimer.current)
    },
    [],
  )

  const chartOption = useMemo(() => {
    const base = chartBase(c)
    return {
      ...base,
      grid: { top: 8, left: 4, right: 8, bottom: 4, containLabel: true },
      xAxis: { ...base.xAxis, type: 'category', data: rateData.times, axisLabel: { ...base.xAxis.axisLabel, fontSize: 10, interval: 9 } },
      yAxis: { ...base.yAxis, type: 'value', minInterval: 1, axisLabel: { ...base.yAxis.axisLabel, fontSize: 10 } },
      series: [
        {
          type: 'line',
          data: rateData.values,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2, color: brandLine(c) },
          areaStyle: brandArea(c),
        },
      ],
      tooltip: { ...base.tooltip, formatter: (p) => `${p[0].axisValue}<br/>消息: <b>${p[0].value}</b> 条/秒` },
      animation: false,
    }
  }, [c, rateData])

  const meta = STATUS_META[status]
  const connected = status === 'connected'

  return (
    <div className="space-y-5">
      <PageHeader title="WebSocket 实时通信" />

      {/* 连接栏 */}
      <div className="surface-card flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="bg-muted text-muted-foreground flex min-w-0 items-center gap-2 rounded-md px-2.5 py-1 font-mono text-xs">
          <Radio className="size-3.5 shrink-0" />
          <span className="truncate">{getWsUrl()}</span>
        </span>
        <StatusBadge tone={meta.tone} dot>
          {meta.label}
        </StatusBadge>
        <div className="ml-auto flex gap-2">
          {connected ? (
            <Button size="sm" variant="outline" className="text-danger hover:text-danger" onClick={disconnect}>
              <Unplug />
              断开
            </Button>
          ) : (
            <Button size="sm" variant="brand" onClick={connect} disabled={status === 'connecting'}>
              {status === 'connecting' ? <Spinner /> : <PlugZap />}
              连接
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* 消息日志 */}
        <section className="surface-card flex h-[420px] flex-col overflow-hidden md:h-[560px]">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-medium">消息日志</h3>
            <div className="text-muted-foreground flex gap-4 text-xs">
              <span className="flex items-center gap-1">
                <ArrowUp className="text-primary size-3" />
                发送 <b className="text-foreground font-medium tabular-nums">{stats.sent}</b>
              </span>
              <span className="flex items-center gap-1">
                <ArrowDown className="text-success size-3" />
                接收 <b className="text-foreground font-medium tabular-nums">{stats.received}</b>
              </span>
            </div>
          </div>

          <div ref={logRef} className="flex-1 space-y-0.5 overflow-y-auto p-2">
            {messages.length === 0 ? (
              <EmptyState icon={PlugZap} title="尚未建立连接" description="点击「连接」建立 WebSocket 连接" className="h-full py-0" />
            ) : (
              messages.map((m) => <MessageRow key={m.id} m={m} />)
            )}
          </div>

          <div className="flex gap-2 border-t p-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSend()
              }}
              placeholder={connected ? '发送自定义消息（服务端会 echo 回来）...' : '请先连接'}
              disabled={!connected}
              className="h-9 flex-1"
            />
            <Button variant="outline" onClick={handleSend} disabled={!connected || !input.trim()}>
              <Send />
              发送
            </Button>
          </div>
        </section>

        {/* 右侧 */}
        <div className="space-y-4">
          <Panel title="消息速率（条/秒）" description={`最近 ${MAX_PTS} 秒`}>
            <ReactECharts option={chartOption} style={{ height: 150 }} opts={{ renderer: 'canvas' }} />
          </Panel>

          <Panel title="消息格式说明">
            <div className="space-y-3">
              {[
                ['metric', '服务器每秒推送 CPU/内存/磁盘/网络'],
                ['echo', '服务端将你发送的消息 echo 回来'],
              ].map(([type, desc]) => (
                <div key={type} className="space-y-1">
                  <StatusBadge tone="brand" className="font-mono">
                    type: {type}
                  </StatusBadge>
                  <p className="text-muted-foreground text-xs">{desc}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="技术栈">
            <dl className="space-y-2 text-xs">
              {[
                ['后端', '@fastify/websocket + systeminformation'],
                ['协议', 'RFC 6455 原生 WebSocket'],
                ['路由', '/ws/devtools'],
                ['推送', '每 1 秒服务器主动推送'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground shrink-0">{k}</dt>
                  <dd className="truncate text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  )
}
