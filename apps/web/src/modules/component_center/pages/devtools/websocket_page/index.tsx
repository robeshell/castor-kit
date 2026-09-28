import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import type { EChartsOption } from 'echarts'
import ReactECharts from '@/shared/components/Chart'
import { motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, CircleCheck, CircleX, Plug, PlugZap, Radio, Send, Unplug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { brandArea, brandLine, chartBase, useChartColors } from '@/lib/chart-theme'
import { EASE_OUT } from '@/lib/motion'
import { cn } from '@/lib/utils'
import i18n from '@/i18n'
import EmptyState from '@/shared/components/EmptyState'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'
import StatusBadge, { type StatusTone } from '@/shared/components/StatusBadge'

const WS_URL = '/ws/devtools' // vite proxy → ws://localhost:5001/ws/devtools
const MAX_MSGS = 300
const MAX_PTS = 40

type ConnStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'closed'
/** in: from the server; out: sent by us; sys: connection events */
type MessageDir = 'in' | 'out' | 'sys'
type SysKind = 'ok' | 'error' | 'closed'

interface LogMessage {
  id: number
  /** Raw frame text, or for sys messages the Chinese source text translated when rendered */
  text: string
  dir: MessageDir
  /** Set on sys messages */
  kind?: SysKind
  /** Interpolation values for a sys message's text */
  params?: Record<string, unknown>
  /** The JSON frame's `type` (metric / echo); null for sys messages and non-JSON text */
  type: string | null
  ts: string
}

const STATUS_META: Record<ConnStatus, { tone: StatusTone; label: string }> = {
  idle: { tone: 'neutral', label: '未连接' },
  connecting: { tone: 'warning', label: '连接中...' },
  connected: { tone: 'success', label: '已连接' },
  error: { tone: 'danger', label: '连接错误' },
  closed: { tone: 'neutral', label: '已断开' },
}

// Icon and color for system messages
const SYS_ICON: Record<SysKind, ComponentType<{ className?: string }>> = { ok: CircleCheck, error: CircleX, closed: Plug }
const SYS_CLASS: Record<SysKind, string> = { ok: 'text-success', error: 'text-danger', closed: 'text-muted-foreground' }

function getWsUrl() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}${WS_URL}`
}

// Server messages are JSON (type: metric / echo); anything unparsable is shown as plain text
function messageType(text: string): string | null {
  try {
    const obj: unknown = JSON.parse(text)
    return obj && typeof obj === 'object' && 'type' in obj && typeof obj.type === 'string' ? obj.type : null
  } catch {
    return null
  }
}

interface MessageRowProps {
  m: LogMessage
}

function MessageRow({ m }: MessageRowProps) {
  const { t } = useTranslation()
  const SysIcon = m.dir === 'sys' ? (m.kind && SYS_ICON[m.kind]) || Radio : null
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
        ) : SysIcon ? (
          <SysIcon className={cn('size-3', m.kind && SYS_CLASS[m.kind])} />
        ) : null}
      </span>
      <span className="leading-[18px] break-all">
        {m.type ? (
          <StatusBadge tone={m.type === 'echo' ? 'brand' : 'neutral'} className="mr-1.5 h-4 px-1 align-[1px] text-[10px]">
            {m.type}
          </StatusBadge>
        ) : null}
        <span className={cn(m.dir === 'sys' && 'font-sans', m.dir === 'sys' && m.kind && SYS_CLASS[m.kind])}>{m.dir === 'sys' ? t(m.text, m.params) : m.text}</span>
      </span>
    </motion.div>
  )
}

export default function WebSocketPage() {
  const { t } = useTranslation()
  const c = useChartColors()
  const [status, setStatus] = useState<ConnStatus>('idle')
  const [messages, setMessages] = useState<LogMessage[]>([])
  const [input, setInput] = useState('')
  const [stats, setStats] = useState({ sent: 0, received: 0 })
  const [rateData, setRateData] = useState<{ times: string[]; values: number[] }>({ times: [], values: [] })

  const wsRef = useRef<WebSocket | null>(null)
  const rateCounter = useRef(0)
  const rateTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const logRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const seqRef = useRef(0)

  // System messages keep the Chinese source text plus params and are translated when rendered
  const addMsg = useCallback((text: string, dir: MessageDir, kind?: SysKind, params?: Record<string, unknown>) => {
    seqRef.current += 1
    const id = seqRef.current
    setMessages((prev) => [
      ...prev.slice(-(MAX_MSGS - 1)),
      {
        id,
        text,
        dir,
        kind,
        params,
        type: dir === 'sys' ? null : messageType(text),
        ts: new Date().toLocaleTimeString(i18n.language, { hour12: false }),
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
          times: [...prev.times.slice(-(MAX_PTS - 1)), new Date().toLocaleTimeString(i18n.language, { hour12: false })],
          values: [...prev.values.slice(-(MAX_PTS - 1)), n],
        }))
      }, 1000)
    }

    ws.onmessage = (e) => {
      // Text frames: the server only sends JSON text
      addMsg(String(e.data), 'in')
      setStats((s) => ({ ...s, received: s.received + 1 }))
    }

    ws.onerror = () => {
      addMsg('连接错误，请确认后端已启动（pnpm dev，端口 5001）', 'sys', 'error')
      setStatus('error')
    }

    ws.onclose = (e) => {
      addMsg('连接已关闭 (code: {{code}})', 'sys', 'closed', { code: e.code })
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

  // Smoothly scroll to the bottom when new messages arrive
  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [messages, reduceMotion])

  useEffect(
    () => () => {
      wsRef.current?.close()
      clearInterval(rateTimer.current)
    },
    [],
  )

  const chartOption = useMemo((): EChartsOption => {
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
      tooltip: {
        ...base.tooltip,
        // trigger: 'axis' (from chartBase) passes an array; its entries also carry axisValue, which echarts' types leave out
        formatter: (p) => {
          const d = Array.isArray(p) ? p[0] : undefined
          if (!d) return ''
          return `${'axisValue' in d ? d.axisValue : ''}<br/>${t('消息')}: <b>${d.value}</b> ${t('条/秒')}`
        },
      },
      animation: false,
    }
  }, [c, rateData, t])

  const meta = STATUS_META[status]
  const connected = status === 'connected'

  return (
    <div className="space-y-5">
      <PageHeader title="WebSocket 实时通信" />

      {/* Connection bar */}
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
              {t('断开')}
            </Button>
          ) : (
            <Button size="sm" variant="brand" onClick={connect} disabled={status === 'connecting'}>
              {status === 'connecting' ? <Spinner /> : <PlugZap />}
              {t('连接')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Message log */}
        <section className="surface-card flex h-[420px] flex-col overflow-hidden md:h-[560px]">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-medium">{t('消息日志')}</h3>
            <div className="text-muted-foreground flex gap-4 text-xs">
              <span className="flex items-center gap-1">
                <ArrowUp className="text-primary size-3" />
                {t('发送')} <b className="text-foreground font-medium tabular-nums">{stats.sent}</b>
              </span>
              <span className="flex items-center gap-1">
                <ArrowDown className="text-success size-3" />
                {t('接收')} <b className="text-foreground font-medium tabular-nums">{stats.received}</b>
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
              placeholder={connected ? t('发送自定义消息（服务端会 echo 回来）...') : t('请先连接')}
              disabled={!connected}
              className="h-9 flex-1"
            />
            <Button variant="outline" onClick={handleSend} disabled={!connected || !input.trim()}>
              <Send />
              {t('发送')}
            </Button>
          </div>
        </section>

        {/* Right column */}
        <div className="space-y-4">
          <Panel title="消息速率（条/秒）" description={t('最近 {{count}} 秒', { count: MAX_PTS })}>
            <ReactECharts option={chartOption} style={{ height: 150 }} opts={{ renderer: 'canvas' }} />
          </Panel>

          <Panel title="消息格式说明">
            <div className="space-y-3">
              {([
                ['metric', '服务器每秒推送 CPU/内存/磁盘/网络'],
                ['echo', '服务端将你发送的消息 echo 回来'],
              ] as const).map(([type, desc]) => (
                <div key={type} className="space-y-1">
                  <StatusBadge tone="brand" className="font-mono">
                    type: {type}
                  </StatusBadge>
                  <p className="text-muted-foreground text-xs">{t(desc)}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="技术栈">
            <dl className="space-y-2 text-xs">
              {([
                ['后端', '@fastify/websocket + systeminformation'],
                ['协议', 'RFC 6455 原生 WebSocket'],
                ['路由', '/ws/devtools'],
                ['推送', '每 1 秒服务器主动推送'],
              ] as const).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground shrink-0">{t(k)}</dt>
                  <dd className="truncate text-right font-medium">{t(v)}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  )
}
