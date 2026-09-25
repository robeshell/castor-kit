import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import { motion } from 'motion/react'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  ArrowRight,
  Bot,
  Box,
  ChartPie,
  FileText,
  LayoutGrid,
  ListTree,
  PenLine,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/context/AuthContext'
import { chartBase, hexToRgba, useChartColors } from '@/lib/chart-theme'
import { formatRelative } from '@/lib/format'
import { stagger } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { getOperationLogs } from '@/modules/admin/api/logs'
import Panel from '@/shared/components/Panel'
import SegmentedTabs from '@/shared/components/SegmentedTabs'
import StatCard from '@/shared/components/StatCard'
import request from '@/shared/api/request'

const QUICK_LINKS = [
  { label: '管理系统', desc: '列表 · 表单 · 看板 · 甘特', icon: LayoutGrid, path: '/component-center/list-page' },
  { label: '数据可视化', desc: '大屏 · 折线 · 热力 · 地图', icon: ChartPie, path: '/component-center/dashboard-page' },
  { label: '3D 创意', desc: '粒子 · CSS 3D · 地球', icon: Box, path: '/component-center/creative/particle' },
  { label: 'AI 应用', desc: '对话 · 提示词 · 数据查询', icon: Bot, path: '/component-center/ai/chat' },
  { label: '编辑器', desc: '富文本 · 代码 · JSON · MD', icon: PenLine, path: '/component-center/editor/rich-text' },
  { label: '工程工具', desc: '拖拽 · 虚拟滚动 · WS', icon: Wrench, path: '/component-center/devtools/drag-layout' },
]

const STACK = ['Node.js 22', 'Fastify 5', 'TypeScript', 'Drizzle ORM', 'PostgreSQL', 'React 19', 'shadcn/ui', 'Tailwind CSS', 'Motion', 'ECharts']

function greeting(hour) {
  if (hour < 6) return '夜深了'
  if (hour < 12) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

function HealthBar({ label, value }) {
  const pct = Math.max(0, Math.min(100, Math.round(value || 0)))
  const tone = pct >= 90 ? 'text-danger' : pct >= 80 ? 'text-warning' : 'text-foreground'
  const bar = pct >= 90 ? 'bg-danger' : pct >= 80 ? 'bg-warning' : 'bg-primary'
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn('font-medium tabular-nums', tone)}>{pct}%</span>
      </div>
      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
        <motion.div
          className={cn('h-full rounded-full', bar)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 22 }}
        />
      </div>
    </div>
  )
}

function SystemHealth() {
  const [stats, setStats] = useState(null)
  const [online, setOnline] = useState(true)

  useEffect(() => {
    let alive = true
    const poll = async () => {
      try {
        const data = await request.get('/admin/component-center/devtools/perf-stats')
        if (alive) {
          setStats(data)
          setOnline(true)
        }
      } catch {
        if (alive) setOnline(false)
      }
    }
    poll()
    const timer = setInterval(poll, 3000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  return (
    <Panel
      title="系统状态"
      actions={
        <span className={cn('flex items-center gap-1.5 text-xs', online ? 'text-success' : 'text-muted-foreground')}>
          <span className={cn('relative flex size-1.5 rounded-full', online ? 'bg-success' : 'bg-muted-foreground')}>
            {online ? <span className="bg-success absolute inset-0 animate-ping rounded-full opacity-60" /> : null}
          </span>
          {online ? '运行正常' : '连接失败'}
        </span>
      }
      className="h-full"
    >
      <div className="space-y-4">
        <HealthBar label="CPU" value={stats?.cpu} />
        <HealthBar label="内存" value={stats?.mem_pct} />
        <HealthBar label="磁盘" value={stats?.disk_pct} />
        <div className="grid grid-cols-2 gap-2 pt-1">
          {[
            { label: '网络发送', value: stats?.net_sent_mb, icon: ArrowUpRight },
            { label: '网络接收', value: stats?.net_recv_mb, icon: ArrowDownRight },
          ].map((item) => (
            <div key={item.label} className="bg-muted/50 rounded-lg px-3 py-2.5">
              <div className="text-muted-foreground flex items-center gap-1 text-[11px]">
                <item.icon className="size-3" />
                {item.label}
              </div>
              <div className="mt-1 text-sm font-medium tabular-nums">
                {(item.value ?? 0).toFixed(2)}
                <span className="text-muted-foreground ml-1 text-xs font-normal">MB/s</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  )
}

function ActivityChart({ stats }) {
  const c = useChartColors()
  const [range, setRange] = useState('7d')
  const option = useMemo(() => {
    const base = chartBase(c)
    const labels = stats?.week_labels?.length ? stats.week_labels : ['', '', '', '', '', '', '']
    const values = stats?.week_log_counts?.length ? stats.week_log_counts : [0, 0, 0, 0, 0, 0, 0]
    return {
      ...base,
      tooltip: { ...base.tooltip, axisPointer: { type: 'shadow', shadowStyle: { color: hexToRgba(c['muted-foreground'], 0.08) } } },
      xAxis: { ...base.xAxis, type: 'category', data: labels },
      yAxis: { ...base.yAxis, type: 'value', minInterval: 1, splitNumber: 4 },
      series: [
        {
          name: '操作日志',
          type: 'bar',
          data: values,
          barMaxWidth: 36,
          itemStyle: {
            borderRadius: [6, 6, 2, 2],
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: c['brand-from'] },
                { offset: 1, color: hexToRgba(c['brand-from'], 0.55) },
              ],
            },
          },
          emphasis: { itemStyle: { color: c['brand-via'] } },
        },
      ],
      animationDuration: 900,
      animationEasing: 'cubicOut',
    }
  }, [c, stats])

  const total = (stats?.week_log_counts || []).reduce((a, b) => a + b, 0)
  return (
    <Panel
      title="系统活跃度"
      description={`近 7 天操作日志，共 ${total} 条`}
      actions={<SegmentedTabs variant="pill" value={range} onChange={setRange} items={[{ value: '7d', label: '7 天' }]} />}
      className="h-full"
    >
      <ReactECharts option={option} style={{ height: 248 }} notMerge opts={{ renderer: 'svg' }} />
    </Panel>
  )
}

function RecentActivity() {
  const navigate = useNavigate()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getOperationLogs({ page: 1, per_page: 7 })
      .then((data) => setLogs(data?.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <Panel
      title="最近操作"
      padded={false}
      actions={
        <Button variant="ghost" size="sm" className="text-primary h-7 px-2 text-xs" onClick={() => navigate('/system/logs')}>
          查看审计日志
          <ArrowRight />
        </Button>
      }
    >
      {loading ? (
        <div className="space-y-2 px-5 pb-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="text-muted-foreground px-5 pb-8 text-center text-sm">暂无操作记录</div>
      ) : (
        <motion.ul variants={stagger.container} initial="hidden" animate="show">
          {logs.map((log) => (
            <motion.li
              key={log.id}
              variants={stagger.item}
              className="hover:bg-muted/40 grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 border-t px-5 py-2.5 text-[13px] transition-colors"
            >
              <span className="bg-muted flex size-7 items-center justify-center rounded-full text-[11px] font-medium">
                {(log.username || '?').slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 truncate">
                <span className="font-medium">{log.username}</span>
                <span className="text-muted-foreground ml-2 text-[11px] font-medium">{log.method}</span>
                <span className="text-muted-foreground ml-1.5">{log.path}</span>
              </span>
              <span className="flex items-center gap-2">
                {log.status_code >= 400 ? (
                  <span className="text-danger text-[11px] font-medium tabular-nums">{log.status_code}</span>
                ) : null}
                <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 text-[11px]">{log.module}</span>
                <span className="text-muted-foreground w-16 text-right text-xs tabular-nums">{formatRelative(log.created_at)}</span>
              </span>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </Panel>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const now = new Date()

  useEffect(() => {
    request
      .get('/admin/dashboard/stats')
      .then((data) => {
        setStats(data && !data.error ? data : {})
      })
      .catch(() => setStats({}))
  }, [])

  const dateText = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-muted-foreground text-[13px]">{dateText}</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting(now.getHours())}，{user?.username}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/system/logs">
              <FileText />
              审计日志
            </Link>
          </Button>
          <Button size="sm" variant="brand" asChild>
            <Link to="/component-center/ai/chat">
              <Sparkles />
              问问 AI
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="注册用户" value={stats?.user_count ?? 0} loading={!stats} suffix="人" icon={Users} />
        <StatCard label="菜单数量" value={stats?.menu_count ?? 0} loading={!stats} suffix="项" icon={ListTree} />
        <StatCard label="角色权限" value={stats?.role_count ?? 0} loading={!stats} suffix="个" icon={ShieldCheck} />
        <StatCard label="今日日志" value={stats?.today_log_count ?? 0} loading={!stats} suffix="条" icon={Activity} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ActivityChart stats={stats} />
        </div>
        <SystemHealth />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentActivity />
        </div>
        <div className="space-y-4">
          <Panel title="组件中心">
            <div className="grid grid-cols-2 gap-2">
              {QUICK_LINKS.map((item) => (
                <Link
                  key={item.label}
                  to={item.path}
                  className="group hover:bg-muted/60 flex items-start gap-2.5 rounded-lg p-2.5 transition-colors"
                >
                  <span className="bg-brand-soft text-primary flex size-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105">
                    <item.icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium">{item.label}</span>
                    <span className="text-muted-foreground block truncate text-[11px]">{item.desc}</span>
                  </span>
                </Link>
              ))}
            </div>
          </Panel>
          <Panel title="技术栈">
            <div className="flex flex-wrap gap-1.5">
              {STACK.map((s) => (
                <span key={s} className="text-muted-foreground rounded-md border px-2 py-0.5 text-[11px]">
                  {s}
                </span>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
