import { useState } from 'react'
import { Tag, Typography } from '@douyinfe/semi-ui'
import { useIsMobile } from '@/shared/hooks/useIsMobile'

const CARDS = [
  { front: { icon: '⚡', title: 'React 18', sub: '前端框架', color: '#61dafb' }, back: { desc: '基于 Concurrent Mode 的现代 React，支持 Suspense 流式渲染、useTransition 优先级调度', tags: ['Concurrent', 'Suspense', 'Hooks'] } },
  { front: { icon: '🦫', title: 'Fastify 5', sub: '后端框架', color: '#00d084' }, back: { desc: 'Node.js 高性能 Web 框架，配合 Zod 校验与 Drizzle ORM 构建类型安全的 RESTful API，插件式模块化路由', tags: ['TypeScript', 'Zod', 'Drizzle'] } },
  { front: { icon: '🎨', title: 'Semi Design', sub: 'UI 组件库', color: '#9b59b6' }, back: { desc: '字节跳动出品的企业级组件库，2000+ 组件、丰富主题定制能力，支持 AI 对话场景', tags: ['2000+组件', 'Dark Mode', 'AI Chat'] } },
  { front: { icon: '🗄️', title: 'PostgreSQL', sub: '关系型数据库', color: '#336791' }, back: { desc: '强大的开源关系型数据库，支持 JSON、全文检索、CTE 递归查询，生产级 RBAC 存储', tags: ['JSONB', 'RBAC', 'ACID'] } },
  { front: { icon: '🔒', title: 'RBAC', sub: '权限系统', color: '#e67e22' }, back: { desc: '基于角色的访问控制，菜单权限细粒度管控，支持超级管理员免鉴权模式', tags: ['角色', '菜单权限', '动态路由'] } },
  { front: { icon: '🤖', title: 'AI-First', sub: '核心理念', color: '#ff6b6b' }, back: { desc: 'PM 用自然语言描述需求，Agent 端到端实现功能，将 AI 能力深度嵌入开发工作流', tags: ['Agent', 'SSE 流式', '提示词工坊'] } },
]

function FlipCard({ card, width = 200 }) {
  const [flipped, setFlipped] = useState(false)
  return (
    <div
      style={{ width, height: 240, perspective: 1000, cursor: 'pointer' }}
      onMouseEnter={() => setFlipped(true)}
      onMouseLeave={() => setFlipped(false)}
    >
      <div style={{
        width: '100%', height: '100%', position: 'relative',
        transformStyle: 'preserve-3d',
        transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
      }}>
        {/* Front */}
        <div style={{
          position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden',
          background: `linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)`,
          borderRadius: 16, border: `1px solid ${card.front.color}33`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
          boxShadow: `0 8px 32px ${card.front.color}22`,
        }}>
          <div style={{ fontSize: 48 }}>{card.front.icon}</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: card.front.color }}>{card.front.title}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{card.front.sub}</div>
          </div>
          <div style={{ width: 40, height: 2, background: card.front.color, borderRadius: 1, opacity: 0.6 }} />
        </div>
        {/* Back */}
        <div style={{
          position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
          background: `linear-gradient(135deg, ${card.front.color}22 0%, ${card.front.color}08 100%)`,
          borderRadius: 16, border: `1px solid ${card.front.color}66`,
          display: 'flex', flexDirection: 'column', padding: 20, boxSizing: 'border-box',
          justifyContent: 'space-between',
          boxShadow: `0 8px 32px ${card.front.color}33`,
        }}>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>{card.back.desc}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {card.back.tags.map(t => (
              <span key={t} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: `${card.front.color}33`, color: card.front.color, border: `1px solid ${card.front.color}55` }}>{t}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function RotatingCube() {
  return (
    <div style={{ perspective: 600, width: 120, height: 120 }}>
      <style>{`
        @keyframes rotateCube {
          0% { transform: rotateX(-20deg) rotateY(0deg); }
          100% { transform: rotateX(-20deg) rotateY(360deg); }
        }
        .cube { width: 120px; height: 120px; position: relative; transform-style: preserve-3d; animation: rotateCube 6s linear infinite; }
        .face { position: absolute; width: 120px; height: 120px; display: flex; align-items: center; justify-content: center; font-size: 32px; border: 1px solid rgba(99,179,255,0.4); background: rgba(30,60,100,0.6); backdrop-filter: blur(4px); }
        .front  { transform: translateZ(60px); }
        .back   { transform: rotateY(180deg) translateZ(60px); }
        .left   { transform: rotateY(-90deg) translateZ(60px); }
        .right  { transform: rotateY(90deg) translateZ(60px); }
        .top    { transform: rotateX(90deg) translateZ(60px); }
        .bottom { transform: rotateX(-90deg) translateZ(60px); }
      `}</style>
      <div className="cube">
        <div className="face front">⚡</div>
        <div className="face back">🔒</div>
        <div className="face left">🎨</div>
        <div className="face right">🤖</div>
        <div className="face top">🗄️</div>
        <div className="face bottom">🐍</div>
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
    <div
      style={{ perspective: 800, cursor: 'pointer' }}
      onMouseMove={handleMove}
      onMouseLeave={() => setTransform('')}
    >
      <div style={{ transition: 'transform 0.1s ease', transform, transformStyle: 'preserve-3d' }}>
        {children}
      </div>
    </div>
  )
}

export default function Css3dPage() {
  const isMobile = useIsMobile()
  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', background: '#0a0a1a', padding: isMobile ? '16px 12px' : 32, overflowY: 'auto' }}>
      <div style={{ marginBottom: 32 }}>
        <Typography.Title heading={4} style={{ margin: 0, color: '#fff' }}>CSS 3D 交互卡片</Typography.Title>
        <Typography.Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
          纯 CSS perspective + transform-style: preserve-3d · 无 JS 动画库
        </Typography.Text>
      </div>

      {/* Section 1: Flip Cards */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Typography.Title heading={6} style={{ margin: 0, color: 'rgba(255,255,255,0.8)' }}>悬停翻转卡片</Typography.Title>
          <Tag color="blue" size="small">hover to flip</Tag>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
          {CARDS.map((c, i) => <FlipCard key={i} card={c} width="100%" />)}
        </div>
      </div>

      {/* Section 2: Rotating Cube + Parallax */}
      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <Typography.Title heading={6} style={{ margin: 0, color: 'rgba(255,255,255,0.8)' }}>自旋立方体</Typography.Title>
            <Tag color="purple" size="small">CSS animation</Tag>
          </div>
          <RotatingCube />
        </div>

        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <Typography.Title heading={6} style={{ margin: 0, color: 'rgba(255,255,255,0.8)' }}>视差跟随卡片</Typography.Title>
            <Tag color="green" size="small">mouse tracking</Tag>
          </div>
          <ParallaxCard>
            <div style={{
              background: 'linear-gradient(135deg, #1a1a3e, #0d1b2a)',
              borderRadius: 20, padding: 32, border: '1px solid rgba(99,179,255,0.2)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🚀</div>
              <div style={{ color: '#63b3ff', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>castor-kit</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.8 }}>
                AI-First 企业级脚手架<br />
                鼠标移动，感受 3D 视差效果<br />
                纯 CSS transform 实现
              </div>
            </div>
          </ParallaxCard>
        </div>
      </div>
    </div>
  )
}
