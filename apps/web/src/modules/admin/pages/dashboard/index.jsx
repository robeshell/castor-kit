import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import request from '@/shared/api/request'
import { getOperationLogs } from '@/modules/admin/api/logs'
import ReactECharts from 'echarts-for-react'
import { Tag, Typography } from '@douyinfe/semi-ui'
import {
  IconApps, IconBox, IconSend, IconDesktop,
  IconEdit2, IconHistogram, IconUser, IconArticle,
  IconList, IconActivity,
} from '@douyinfe/semi-icons'
import { useAuth } from '@/context/AuthContext'

const { Title } = Typography

const C = {
  blue: '#4080FF', purple: '#9254DE', green: '#00B96B',
  orange: '#FA8C16', cyan: '#13C2C2', red: '#FF4D4F', indigo: '#5B6EF5',
}

// ─── CountUp ─────────────────────────────────────────────────────────────────
function useCountUp(target, duration = 1200) {
  const [value, setValue] = useState(0)
  const prevRef = useRef(0)
  useEffect(() => {
    const from = prevRef.current
    prevRef.current = target
    if (from === target) return
    let start = null
    let rafId = null
    const step = ts => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setValue(Math.floor(from + (target - from) * ease))
      if (p < 1) rafId = requestAnimationFrame(step)
      else setValue(target)
    }
    rafId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafId)
  }, [target, duration])
  return value
}

// ─── 配置 ─────────────────────────────────────────────────────────────────────
const NAV_MODULES = [
  { key: 'admin',    label: '管理系统',   desc: '用户·角色·菜单·字典',   icon: <IconApps />,     color: C.blue,   path: '/component-center/list-page' },
  { key: 'dataviz',  label: '数据可视化', desc: '大屏·折线·热力·地图',   icon: <IconHistogram />,color: C.purple, path: '/component-center/dashboard-page' },
  { key: 'creative', label: '3D 创意',   desc: '粒子·CSS3D·Globe·形变', icon: <IconBox />,      color: C.cyan,   path: '/component-center/creative/particle' },
  { key: 'ai',       label: 'AI 应用',   desc: 'AI 对话·提示词工坊',    icon: <IconSend />,     color: C.indigo, path: '/component-center/ai/chat' },
  { key: 'editor',   label: '编辑器',    desc: '富文本·代码·JSON·MD',   icon: <IconEdit2 />,    color: C.orange, path: '/component-center/editor/rich-text' },
  { key: 'devtools', label: '工程工具',  desc: '拖拽·虚拟滚动·WS·性能', icon: <IconDesktop />,  color: C.green,  path: '/component-center/devtools/drag-layout' },
]

const TECH_TAGS = [
  { label: 'Node.js 22', color: 'green' }, { label: 'Fastify 5', color: 'grey' },
  { label: 'TypeScript', color: 'blue' }, { label: 'Drizzle ORM', color: 'lime' },
  { label: 'PostgreSQL', color: 'indigo' }, { label: 'React 18', color: 'cyan' },
  { label: 'Vite', color: 'yellow' }, { label: 'Semi Design', color: 'purple' },
  { label: 'ECharts 6', color: 'orange' }, { label: 'Three.js', color: 'teal' },
]

const LOG_STATUS = {
  success: { color: '#00B96B', bg: '#E8FBF2', label: '成功' },
  error:   { color: '#FF4D4F', bg: '#FFF1F0', label: '失败' },
}

function gaugeColor(v) {
  if (v < 50) return C.green
  if (v < 75) return C.orange
  return C.red
}

// ─── 冰晶横幅 ─────────────────────────────────────────────────────────────────
const ICE_SPARKS = Array.from({ length: 28 }, (_, i) => ({
  left: `${(i * 37 + 11) % 100}%`,
  top:  `${(i * 53 + 7)  % 100}%`,
  size: (i % 3) + 1,
  delay: `${(i * 0.37).toFixed(2)}s`,
  dur:   `${2.2 + (i % 4) * 0.6}s`,
}))

function ParticleBanner({ children, isMobile }) {
  return (
    <div style={{
      borderRadius: 16, marginBottom: 24, padding: isMobile ? '20px 16px' : '32px 40px',
      background: 'linear-gradient(135deg, #060d24 0%, #0a1a3e 40%, #071428 70%, #040e20 100%)',
      boxShadow: '0 12px 52px rgba(56,189,248,0.22), 0 0 0 1px rgba(147,210,255,0.08)',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      position: 'relative', overflow: 'hidden', minHeight: 120,
    }}>

      {/* 冰色光球 */}
      <div style={{ position:'absolute', width:520, height:360, borderRadius:'50%', top:-140, left:-80,
        background:'radial-gradient(circle, rgba(56,189,248,0.28) 0%, rgba(99,179,255,0.12) 40%, transparent 70%)',
        filter:'blur(56px)', animation:'orbA 11s ease-in-out infinite', pointerEvents:'none' }} />
      <div style={{ position:'absolute', width:400, height:300, borderRadius:'50%', top:-60, left:'28%',
        background:'radial-gradient(circle, rgba(147,210,255,0.22) 0%, rgba(56,189,248,0.08) 50%, transparent 70%)',
        filter:'blur(60px)', animation:'orbB 14s ease-in-out infinite', pointerEvents:'none' }} />
      <div style={{ position:'absolute', width:360, height:280, borderRadius:'50%', bottom:-110, right:'8%',
        background:'radial-gradient(circle, rgba(99,102,241,0.32) 0%, rgba(56,189,248,0.12) 50%, transparent 70%)',
        filter:'blur(50px)', animation:'orbC 8s ease-in-out infinite', pointerEvents:'none' }} />
      <div style={{ position:'absolute', width:280, height:220, borderRadius:'50%', top:10, right:'22%',
        background:'radial-gradient(circle, rgba(186,230,255,0.18) 0%, transparent 68%)',
        filter:'blur(40px)', animation:'orbD 9s ease-in-out infinite', pointerEvents:'none' }} />

      {/* 冰晶噪点纹理 */}
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:0.045, pointerEvents:'none' }}>
        <filter id="ice-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#ice-noise)" />
      </svg>

      {/* 闪烁冰晶粒子 */}
      {ICE_SPARKS.map((s, i) => (
        <div key={i} style={{
          position: 'absolute', left: s.left, top: s.top,
          width: s.size, height: s.size, borderRadius: '50%',
          background: 'rgba(200,235,255,0.9)',
          animation: `sparkle ${s.dur} ${s.delay} ease-in-out infinite`,
          pointerEvents: 'none',
        }} />
      ))}

      {/* 顶部冰霜光边 */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:1,
        background:'linear-gradient(90deg, transparent, rgba(147,210,255,0.4) 30%, rgba(200,240,255,0.6) 50%, rgba(147,210,255,0.4) 70%, transparent)',
        pointerEvents:'none' }} />
      {/* 底部微光 */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:60,
        background:'linear-gradient(0deg, rgba(56,189,248,0.04) 0%, transparent 100%)',
        pointerEvents:'none' }} />
      {/* 磨砂蒙版 */}
      <div style={{ position:'absolute', inset:0, background:'rgba(4,10,26,0.25)', pointerEvents:'none' }} />

      <div style={{ position:'relative', zIndex:1, flex:1 }}>{children}</div>
    </div>
  )
}

// ─── Spark ────────────────────────────────────────────────────────────────────
function makeSparkOption(data, color) {
  return {
    animation: false,
    grid: { top: 4, bottom: 4, left: 4, right: 4 },
    xAxis: { type: 'category', show: false, boundaryGap: false },
    yAxis: { type: 'value', show: false, scale: true },
    series: [{
      type: 'line', data, smooth: 0.4, symbol: 'none',
      lineStyle: { color, width: 2 },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [{ offset: 0, color: color + '40' }, { offset: 1, color: color + '00' }] } },
    }],
  }
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ title, value, unit, icon, color, spark, style: extraStyle }) {
  const displayed = useCountUp(value)
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--semi-color-bg-1)', borderRadius: 12, padding: '20px 20px 12px',
        boxShadow: hovered ? '0 8px 32px rgba(15,23,42,0.12)' : '0 1px 4px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.06)',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'all 0.25s cubic-bezier(.4,0,.2,1)',
        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8,
        ...extraStyle,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--semi-color-text-2)', marginBottom: 6 }}>{title}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--semi-color-text-0)', letterSpacing: '-0.5px' }}>
              {displayed.toLocaleString()}
            </span>
            <span style={{ fontSize: 13, color: 'var(--semi-color-text-2)' }}>{unit}</span>
          </div>
        </div>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
          {icon}
        </div>
      </div>
      <ReactECharts option={makeSparkOption(spark, color)} style={{ height: 48 }} opts={{ renderer: 'canvas' }} />
    </div>
  )
}

// ─── NavCard ──────────────────────────────────────────────────────────────────
function NavCard({ mod, onClick, isMobile }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? mod.color + '0e' : 'var(--semi-color-bg-1)',
        border: `1.5px solid ${hovered ? mod.color + '60' : 'var(--semi-color-border)'}`,
        borderRadius: 12, padding: isMobile ? '10px 10px' : '16px 18px', cursor: 'pointer',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: hovered ? `0 8px 24px ${mod.color}22` : '0 1px 4px rgba(15,23,42,0.05)',
        transition: 'all 0.22s cubic-bezier(.4,0,.2,1)',
        display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14,
      }}>
      <div style={{ width: isMobile ? 32 : 42, height: isMobile ? 32 : 42, borderRadius: 8, background: `linear-gradient(135deg, ${mod.color}cc, ${mod.color})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: isMobile ? 14 : 18, flexShrink: 0, boxShadow: `0 4px 12px ${mod.color}44` }}>
        {mod.icon}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: isMobile ? 12 : 14, color: 'var(--semi-color-text-0)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mod.label}</div>
        {!isMobile && <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mod.desc}</div>}
      </div>
    </div>
  )
}

// ─── MetricBar ────────────────────────────────────────────────────────────────
function MetricBar({ label, value }) {
  const color = gaugeColor(value)
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--semi-color-text-2)' }}>{label}</span>
        <span style={{ fontSize: 16, fontWeight: 700, color }}>{value}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--semi-color-text-2)', marginLeft: 2 }}>%</span></span>
      </div>
      <div style={{ height: 9, borderRadius: 5, background: 'var(--semi-color-fill-1)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 5, width: `${Math.min(value, 100)}%`, background: `linear-gradient(90deg, ${color}88, ${color})`, transition: 'width .7s cubic-bezier(.4,0,.2,1)' }} />
      </div>
    </div>
  )
}

// ─── SysStatusCard ────────────────────────────────────────────────────────────
function SysStatusCard() {
  const [stats, setStats] = useState(null)
  const [online, setOnline] = useState(true)
  useEffect(() => {
    let alive = true
    const poll = async () => {
      try {
        const data = await request.get('/admin/component-center/devtools/perf-stats')
        if (alive) { setStats(data); setOnline(true) }
      } catch { if (alive) setOnline(false) }
    }
    poll()
    const t = setInterval(poll, 3000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  return (
    <div style={{
      background: 'var(--semi-color-bg-1)', borderRadius: 12, padding: '24px 28px',
      boxShadow: '0 1px 4px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.06)',
      display: 'flex', flexDirection: 'column', flex: 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--semi-color-text-0)' }}>实时系统状态</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: online ? C.green : C.red, boxShadow: online ? `0 0 6px ${C.green}` : 'none' }} />
          <span style={{ fontSize: 11, color: online ? C.green : 'var(--semi-color-text-2)' }}>{online ? '服务正常' : '连接失败'}</span>
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)', marginBottom: 24 }}>每 3 秒刷新 · 真实机器数据</div>

      {!stats ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--semi-color-text-3)', fontSize: 13 }}>加载中…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 进度条区 */}
          <div style={{ flex: 1 }}>
            <MetricBar label="CPU 使用率" value={Math.round(stats.cpu)} />
            <MetricBar label="内存使用率" value={Math.round(stats.mem_pct)} />
            <MetricBar label="磁盘使用率" value={Math.round(stats.disk_pct)} />
          </div>
          {/* 网络 IO 卡片 */}
          <div style={{ display: 'flex', gap: 12 }}>
            {[
              { label: '↑ 网络发送', value: `${(stats.net_sent_mb ?? 0).toFixed(2)} MB/s`, color: C.blue },
              { label: '↓ 网络接收', value: `${(stats.net_recv_mb ?? 0).toFixed(2)} MB/s`, color: C.purple },
            ].map(item => (
              <div key={item.label} style={{ flex: 1, borderRadius: 10, padding: '14px 18px', background: item.color + '0d', border: `1px solid ${item.color}22` }}>
                <div style={{ fontSize: 11, color: 'var(--semi-color-text-2)', marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: item.color }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [now, setNow] = useState(new Date())
  const [dashStats, setDashStats] = useState(null)
  const [logs, setLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(true)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    request.get('/admin/dashboard/stats')
      .then(data => { if (data && !data.error) setDashStats(data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    getOperationLogs({ page: 1, per_page: 8 })
      .then(data => { setLogs(data.items ?? []); setLogsLoading(false) })
      .catch(() => setLogsLoading(false))
  }, [])

  const dateStr = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
  const greeting = (() => {
    const h = now.getHours()
    if (h < 6) return '夜深了，注意休息 🌙'
    if (h < 12) return '早上好，元气满满 ☀️'
    if (h < 14) return '午间好，记得休息 🍱'
    if (h < 18) return '下午好，保持专注 💪'
    return '晚上好，辛苦了 🌟'
  })()

  const weekCounts = dashStats?.week_log_counts ?? [0, 0, 0, 0, 0, 0, 0]
  const STATS = [
    { title: '注册用户', value: dashStats?.user_count ?? 0,      unit: '人', icon: <IconUser size="extra-large" />,     color: C.blue,   spark: weekCounts },
    { title: '菜单数量', value: dashStats?.menu_count ?? 0,      unit: '项', icon: <IconList size="extra-large" />,     color: C.purple, spark: weekCounts },
    { title: '角色权限', value: dashStats?.role_count ?? 0,      unit: '个', icon: <IconArticle size="extra-large" />, color: C.green,  spark: weekCounts },
    { title: '今日日志', value: dashStats?.today_log_count ?? 0, unit: '条', icon: <IconActivity size="extra-large" />,color: C.orange, spark: weekCounts },
  ]

  return (
    <div style={{ padding: '0 0 32px', maxWidth: 1400, margin: '0 auto' }}>
      <style>{`
        @keyframes orbA {
          0%,100% { transform: translate(0,0) scale(1); }
          33%     { transform: translate(50px,-30px) scale(1.1); }
          66%     { transform: translate(-24px,20px) scale(0.93); }
        }
        @keyframes orbB {
          0%,100% { transform: translate(0,0) scale(1); }
          40%     { transform: translate(-36px,24px) scale(1.06); }
          70%     { transform: translate(28px,-20px) scale(0.96); }
        }
        @keyframes orbC {
          0%,100% { transform: translate(0,0) scale(1); }
          50%     { transform: translate(-32px,-24px) scale(1.12); }
        }
        @keyframes orbD {
          0%,100% { transform: translate(0,0) scale(1); }
          45%     { transform: translate(24px,16px) scale(0.91); }
          80%     { transform: translate(-18px,-12px) scale(1.05); }
        }
        @keyframes sparkle {
          0%,100% { opacity: 0.1; transform: scale(0.6); }
          50%     { opacity: 1;   transform: scale(1.4); }
        }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(14px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .bu-greeting { animation: fadeUp .55s ease both; }
        .bu-sub      { animation: fadeUp .55s .14s ease both; opacity:0; animation-fill-mode:forwards; }
        .bu-time     { animation: fadeUp .55s .06s ease both; opacity:0; animation-fill-mode:forwards; }
      `}</style>

      {/* ── Banner ── */}
      <ParticleBanner isMobile={isMobile}>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? 12 : 0 }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 4 }}>{dateStr}</div>
            <Title heading={isMobile ? 4 : 2} className="bu-greeting" style={{ color: '#fff', margin: 0, fontWeight: 800, textShadow: '0 2px 12px rgba(0,0,0,0.15)' }}>
              {greeting}，{user?.username ?? 'Guest'} 👋
            </Title>
            {!isMobile && <div className="bu-sub" style={{ color: 'rgba(255,255,255,0.6)', marginTop: 10, fontSize: 14, letterSpacing: 0.3 }}>
              用自然语言描述需求，让 Agent 端到端实现 · castor-kit AI-First 脚手架
            </div>}
          </div>
          <div className="bu-time" style={{ textAlign: isMobile ? 'left' : 'right', paddingLeft: isMobile ? 0 : 40 }}>
            <div style={{ fontSize: isMobile ? 36 : 52, fontWeight: 900, color: '#fff', letterSpacing: isMobile ? 1 : 3, lineHeight: 1, textShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              {now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 4, letterSpacing: 1 }}>CURRENT TIME</div>
          </div>
        </div>
      </ParticleBanner>

      {/* ── 统计卡片 ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        {STATS.map(s => <StatCard key={s.title} {...s} style={{ flex: isMobile ? '1 1 calc(50% - 8px)' : 1 }} />)}
      </div>

      {/* ── 系统状态（全宽） ── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <SysStatusCard />
      </div>

      {/* ── 导航 + 日志 ── */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16, marginBottom: 20 }}>
        <div style={{ background: 'var(--semi-color-bg-1)', borderRadius: 12, padding: '20px 20px 16px', boxShadow: '0 1px 4px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.06)', flex: isMobile ? 'none' : '0 0 480px' }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--semi-color-text-0)', marginBottom: 4 }}>组件中心</div>
          <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)', marginBottom: 16 }}>点击快速跳转各功能模块</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {NAV_MODULES.map(mod => <NavCard key={mod.key} mod={mod} onClick={() => navigate(mod.path)} isMobile={isMobile} />)}
          </div>
        </div>

        <div style={{ background: 'var(--semi-color-bg-1)', borderRadius: 12, padding: '20px 20px 16px', boxShadow: '0 1px 4px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.06)', flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--semi-color-text-0)', marginBottom: 4 }}>最新操作日志</div>
          <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)', marginBottom: 16 }}>系统实时操作记录</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {logsLoading ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--semi-color-text-3)', fontSize: 13 }}>加载中…</div>
            ) : logs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--semi-color-text-3)', fontSize: 13 }}>暂无日志</div>
            ) : logs.map(log => {
              const isErr = (log.status_code ?? 200) >= 400
              const meta = LOG_STATUS[isErr ? 'error' : 'success']
              const timeStr = log.created_at
                ? new Date(log.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : '--'
              return (
                <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10, padding: isMobile ? '6px 10px' : '8px 14px', borderRadius: 8, background: 'var(--semi-color-fill-0)', border: '1px solid var(--semi-color-border)' }}>
                  <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: meta.color, background: meta.bg, borderRadius: 4, padding: '2px 6px', border: `1px solid ${meta.color}30` }}>{meta.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--semi-color-text-3)', flexShrink: 0, width: isMobile ? 54 : 68 }}>{timeStr}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.indigo, flexShrink: 0, background: 'var(--semi-color-primary-light-default)', borderRadius: 4, padding: '1px 6px' }}>{log.username}</span>
                  {!isMobile && <span style={{ fontSize: 11, color: 'var(--semi-color-text-2)', flexShrink: 0, background: 'var(--semi-color-fill-0)', borderRadius: 4, padding: '1px 6px' }}>{log.module ?? '-'}</span>}
                  <span style={{ fontSize: 12, color: 'var(--semi-color-text-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.method} {log.path}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, flexShrink: 0, color: isErr ? C.red : C.green }}>{log.status_code ?? 200}</span>
                </div>
              )
            })}
          </div>
          <div onClick={() => navigate('/system/logs')} style={{ marginTop: 14, textAlign: 'center', fontSize: 13, color: C.blue, cursor: 'pointer', padding: '6px 0' }}>
            查看全部日志 →
          </div>
        </div>
      </div>

      {/* ── 技术栈 ── */}
      <div style={{ background: 'var(--semi-color-bg-1)', borderRadius: 12, padding: '18px 24px', boxShadow: '0 1px 4px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.06)' }}>
        <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--semi-color-text-2)', marginBottom: 12, letterSpacing: 1, textTransform: 'uppercase' }}>POWERED BY</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {TECH_TAGS.map(t => <Tag key={t.label} color={t.color} size="large" style={{ borderRadius: 6, fontWeight: 500 }}>{t.label}</Tag>)}
        </div>
      </div>
    </div>
  )
}
