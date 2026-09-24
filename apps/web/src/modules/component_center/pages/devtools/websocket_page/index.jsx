import { useCallback, useEffect, useRef, useState } from 'react'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { Button, Input, Tag, Typography } from '@douyinfe/semi-ui'
import { IconClose, IconSend, IconRefresh } from '@douyinfe/semi-icons'
import ReactECharts from 'echarts-for-react'

const CARD = {
  background: 'var(--semi-color-bg-1)', borderRadius: 10,
  boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 8px 24px rgba(15,23,42,0.06)',
}
// ECharts option 渲染到 canvas，不支持 CSS 变量 → 保留具体色值
const C = { blue: '#4080FF', green: '#00B96B', orange: '#FA8C16', red: '#FF4D4F', border: '#eaedf1', text0: '#1a1a1a', text2: '#8c8c8c' }
// 真实 DOM 颜色 → Semi Design CSS 变量（暗黑模式自适应）
const DOM = { border: 'var(--semi-color-border)', text0: 'var(--semi-color-text-0)', text2: 'var(--semi-color-text-2)' }

const WS_URL = '/ws/devtools'  // vite proxy → ws://localhost:5001/ws/devtools
const MAX_MSGS = 300
const MAX_PTS  = 40

function getWsUrl() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}${WS_URL}`
}

export default function WebSocketPage() {
  const isMobile = useIsMobile()
  const [status, setStatus]   = useState('idle')
  const [messages, setMessages] = useState([])
  const [input, setInput]     = useState('')
  const [stats, setStats]     = useState({ sent: 0, received: 0 })
  const [rateData, setRateData] = useState({ times: [], values: [] })

  const wsRef       = useRef(null)
  const rateCounter = useRef(0)
  const rateTimer   = useRef(null)
  const logRef      = useRef(null)

  const addMsg = useCallback((text, dir) => {
    setMessages(prev => [
      ...prev.slice(-(MAX_MSGS - 1)),
      { id: Date.now() + Math.random(), text, dir, ts: new Date().toLocaleTimeString('zh', { hour12: false }) },
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
      addMsg('✅ WebSocket 连接已建立（后端实时推送服务器指标）', 'sys')
      rateTimer.current = setInterval(() => {
        const c = rateCounter.current
        rateCounter.current = 0
        setRateData(prev => ({
          times:  [...prev.times.slice(-(MAX_PTS - 1)),  new Date().toLocaleTimeString('zh', { hour12: false })],
          values: [...prev.values.slice(-(MAX_PTS - 1)), c],
        }))
      }, 1000)
    }

    ws.onmessage = e => {
      addMsg(e.data, 'in')
      setStats(s => ({ ...s, received: s.received + 1 }))
    }

    ws.onerror = () => {
      addMsg('❌ 连接错误，请确认后端已启动（pnpm dev，端口 5001）', 'sys')
      setStatus('error')
    }

    ws.onclose = e => {
      addMsg(`🔌 连接已关闭 (code: ${e.code})`, 'sys')
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
    setStats(s => ({ ...s, sent: s.sent + 1 }))
    setInput('')
  }, [input, status, addMsg])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [messages])

  useEffect(() => () => { wsRef.current?.close(); clearInterval(rateTimer.current) }, [])

  const statusMeta = {
    idle:       { color: 'grey',   label: '未连接' },
    connecting: { color: 'orange', label: '连接中...' },
    connected:  { color: 'green',  label: '已连接' },
    error:      { color: 'red',    label: '连接错误' },
    closed:     { color: 'grey',   label: '已断开' },
  }

  const chartOption = {
    backgroundColor: 'transparent',
    grid: { top: 8, left: 36, right: 12, bottom: 22 },
    xAxis: { type: 'category', data: rateData.times, axisLabel: { fontSize: 10, color: C.text2, interval: 4 } },
    yAxis: { type: 'value', minInterval: 1, axisLabel: { fontSize: 10, color: C.text2 } },
    series: [{
      type: 'line', data: rateData.values, smooth: true, symbol: 'none',
      lineStyle: { color: C.green, width: 2 },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: C.green + '44' }, { offset: 1, color: C.green + '00' }] } },
    }],
    tooltip: { trigger: 'axis', formatter: p => `${p[0].axisValue}<br/>消息: <b>${p[0].value}</b> 条/秒` },
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Typography.Title heading={4} style={{ margin: 0 }}>WebSocket 实时通信</Typography.Title>
        <Typography.Text type="tertiary" style={{ fontSize: 13 }}>
          后端每秒推送真实服务器指标（CPU/内存/网络），支持双向消息收发
        </Typography.Text>
      </div>

      {/* 连接栏 */}
      <div style={{ ...CARD, padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <code style={{ fontSize: 13, color: DOM.text2, background: 'var(--semi-color-bg-0)', padding: '4px 10px', borderRadius: 6 }}>{getWsUrl()}</code>
        <Tag color={statusMeta[status].color}>{statusMeta[status].label}</Tag>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {status === 'connected'
            ? <Button type="danger" icon={<IconClose />} onClick={disconnect}>断开</Button>
            : <Button type="primary" icon={<IconRefresh />} onClick={connect} loading={status === 'connecting'}>连接</Button>
          }
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: 16 }}>
        {/* 消息日志 */}
        <div style={{ ...CARD, padding: 0, display: 'flex', flexDirection: 'column', height: isMobile ? 400 : 540 }}>
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${DOM.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography.Text strong style={{ fontSize: 14 }}>消息日志</Typography.Text>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: DOM.text2 }}>
              <span>↑ 发送 <b style={{ color: C.blue }}>{stats.sent}</b></span>
              <span>↓ 接收 <b style={{ color: C.green }}>{stats.received}</b></span>
            </div>
          </div>

          <div ref={logRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 16px', fontFamily: 'monospace', fontSize: 12 }}>
            {messages.length === 0 && (
              <div style={{ color: DOM.text2, textAlign: 'center', marginTop: 60, fontSize: 14 }}>
                点击「连接」建立 WebSocket 连接
              </div>
            )}
            {messages.map(m => (
              <div key={m.id} style={{ marginBottom: 5, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: DOM.text2, flexShrink: 0, fontSize: 11 }}>{m.ts}</span>
                <span style={{ flexShrink: 0, fontSize: 11, color: m.dir === 'in' ? C.green : m.dir === 'out' ? C.blue : DOM.text2 }}>
                  {m.dir === 'in' ? '↓' : m.dir === 'out' ? '↑' : '·'}
                </span>
                <span style={{ color: DOM.text0, wordBreak: 'break-all', lineHeight: 1.5 }}>{m.text}</span>
              </div>
            ))}
          </div>

          <div style={{ padding: '10px 12px', borderTop: `1px solid ${DOM.border}`, display: 'flex', gap: 8 }}>
            <Input
              value={input}
              onChange={setInput}
              onEnterPress={handleSend}
              placeholder={status === 'connected' ? '发送自定义消息（服务端会 echo 回来）...' : '请先连接'}
              disabled={status !== 'connected'}
              style={{ flex: 1 }}
            />
            <Button icon={<IconSend />} type="primary" onClick={handleSend} disabled={status !== 'connected' || !input.trim()}>发送</Button>
          </div>
        </div>

        {/* 右侧 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...CARD, padding: '14px 16px' }}>
            <Typography.Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>消息速率（条/秒）</Typography.Text>
            <ReactECharts option={chartOption} style={{ height: 150 }} opts={{ renderer: 'canvas' }} />
          </div>

          <div style={{ ...CARD, padding: '14px 16px' }}>
            <Typography.Text strong style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>消息格式说明</Typography.Text>
            {[
              ['metric', '服务器每秒推送 CPU/内存/磁盘/网络'],
              ['echo',   '服务端将你发送的消息 echo 回来'],
            ].map(([type, desc]) => (
              <div key={type} style={{ marginBottom: 10 }}>
                <Tag color="blue" size="small" style={{ fontFamily: 'monospace' }}>type: {type}</Tag>
                <div style={{ fontSize: 12, color: DOM.text2, marginTop: 4 }}>{desc}</div>
              </div>
            ))}
          </div>

          <div style={{ ...CARD, padding: '14px 16px' }}>
            <Typography.Text strong style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>技术栈</Typography.Text>
            {[
              ['后端', '@fastify/websocket + systeminformation'],
              ['协议', 'RFC 6455 原生 WebSocket'],
              ['路由', '/ws/devtools'],
              ['推送', '每 1 秒服务器主动推送'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: DOM.text2 }}>{k}</span>
                <span style={{ color: DOM.text0, fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
