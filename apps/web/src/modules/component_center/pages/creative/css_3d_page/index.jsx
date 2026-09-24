import { useState } from 'react'
import { Atom, Bot, Database, Layers, Lock, Palette, Rocket, Server, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'
import StatusBadge from '@/shared/components/StatusBadge'
import './css-3d.css'

const CARDS = [
  {
    icon: Atom,
    title: 'React 19',
    sub: '前端框架',
    desc: '基于 Concurrent 渲染的现代 React，支持 Suspense 流式渲染、useTransition 优先级调度',
    tags: ['Concurrent', 'Suspense', 'Hooks'],
  },
  {
    icon: Server,
    title: 'Fastify 5',
    sub: '后端框架',
    desc: 'Node.js 高性能 Web 框架，配合 Zod 校验与 Drizzle ORM 构建类型安全的 RESTful API，插件式模块化路由',
    tags: ['TypeScript', 'Zod', 'Drizzle'],
  },
  {
    icon: Palette,
    title: 'shadcn/ui',
    sub: 'UI 组件',
    desc: '基于 Radix 的开源组件源码，配合 Tailwind CSS 与 motion，亮暗主题与动效统一可控',
    tags: ['Radix', 'Tailwind', 'Dark Mode'],
  },
  {
    icon: Database,
    title: 'PostgreSQL',
    sub: '关系型数据库',
    desc: '强大的开源关系型数据库，支持 JSON、全文检索、CTE 递归查询，生产级 RBAC 存储',
    tags: ['JSONB', 'RBAC', 'ACID'],
  },
  {
    icon: Lock,
    title: 'RBAC',
    sub: '权限系统',
    desc: '基于角色的访问控制，菜单权限细粒度管控，支持超级管理员免鉴权模式',
    tags: ['角色', '菜单权限', '动态路由'],
  },
  {
    icon: Bot,
    title: 'AI-First',
    sub: '核心理念',
    desc: 'PM 用自然语言描述需求，Agent 端到端实现功能，将 AI 能力深度嵌入开发工作流',
    tags: ['Agent', 'SSE 流式', '提示词工坊'],
  },
]

const CUBE_FACES = [
  { cls: 'css3d-front', icon: Zap },
  { cls: 'css3d-back', icon: Lock },
  { cls: 'css3d-left', icon: Palette },
  { cls: 'css3d-right', icon: Bot },
  { cls: 'css3d-top', icon: Database },
  { cls: 'css3d-bottom', icon: Server },
]

function FlipCard({ card }) {
  const [flipped, setFlipped] = useState(false)
  const Icon = card.icon
  return (
    <div
      className="h-60 cursor-pointer [perspective:1000px]"
      onPointerEnter={(e) => e.pointerType === 'mouse' && setFlipped(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setFlipped(false)}
      // 触屏没有 hover，点按切换
      onPointerUp={(e) => e.pointerType !== 'mouse' && setFlipped((v) => !v)}
    >
      <div
        className={cn(
          'relative size-full transition-transform duration-[600ms] ease-[cubic-bezier(0.32,0.72,0,1)] [transform-style:preserve-3d]',
          flipped && '[transform:rotateY(180deg)]',
        )}
      >
        {/* 正面 */}
        <div className="surface-card absolute inset-0 flex flex-col items-center justify-center gap-4 [backface-visibility:hidden]">
          <span className="bg-brand-soft text-primary flex size-14 items-center justify-center rounded-2xl">
            <Icon className="size-7" strokeWidth={1.6} />
          </span>
          <div className="text-center">
            <div className="text-base font-semibold tracking-tight">{card.title}</div>
            <div className="text-muted-foreground mt-0.5 text-xs">{card.sub}</div>
          </div>
          <span className="bg-brand-gradient h-0.5 w-10 rounded-full opacity-70" />
        </div>
        {/* 背面 */}
        <div className="bg-brand-gradient-strong shadow-brand absolute inset-0 flex flex-col justify-between rounded-[14px] p-5 text-white [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <p className="text-[13px] leading-relaxed text-white/90">{card.desc}</p>
          <div className="flex flex-wrap gap-1.5">
            {card.tags.map((t) => (
              <span key={t} className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] ring-1 ring-white/25">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function RotatingCube() {
  return (
    <div className="flex h-56 items-center justify-center">
      <div className="[perspective:600px]">
        <div className="css3d-cube">
          {CUBE_FACES.map(({ cls, icon: Icon }) => (
            <div key={cls} className={cn('css3d-face', cls)}>
              <Icon className="size-8" strokeWidth={1.5} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ParallaxCard({ children }) {
  const [transform, setTransform] = useState('')
  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const cx = (e.clientX - rect.left) / rect.width - 0.5
    const cy = (e.clientY - rect.top) / rect.height - 0.5
    setTransform(`rotateY(${cx * 20}deg) rotateX(${-cy * 20}deg) scale(1.04)`)
  }
  return (
    <div className="cursor-pointer [perspective:800px]" onMouseMove={handleMove} onMouseLeave={() => setTransform('')}>
      <div className="transition-transform duration-100 ease-out [transform-style:preserve-3d]" style={{ transform }}>
        {children}
      </div>
    </div>
  )
}

export default function Css3dPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="CSS 3D 交互卡片" />

      <Panel title="悬停翻转卡片" description="鼠标悬停（触屏点按）翻到背面">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
          {CARDS.map((c) => (
            <FlipCard key={c.title} card={c} />
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Panel title="自旋立方体">
          <RotatingCube />
        </Panel>

        <Panel title="视差跟随卡片">
          <div className="flex h-56 items-center justify-center">
            <div className="w-full max-w-md">
              <ParallaxCard>
                <div className="border-brand-gradient rounded-[18px] p-7 shadow-[0_24px_48px_-24px_var(--brand-shadow)]">
                  <span className="bg-brand-gradient-strong mb-4 flex size-11 items-center justify-center rounded-xl text-white">
                    <Rocket className="size-5" />
                  </span>
                  <div className="text-brand-gradient mb-2 text-xl font-semibold tracking-tight">castor-kit</div>
                  <div className="text-muted-foreground space-y-0.5 text-sm leading-relaxed">
                    <p>AI-First 企业级脚手架</p>
                    <p>鼠标移动，感受 3D 视差效果</p>
                    <p className="flex items-center gap-1.5">
                      <Layers className="size-3.5" />
                      纯 CSS transform 实现
                    </p>
                  </div>
                </div>
              </ParallaxCard>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}
