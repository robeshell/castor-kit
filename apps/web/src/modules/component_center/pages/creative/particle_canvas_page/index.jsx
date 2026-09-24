import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Select, Slider, Tag, Typography } from '@douyinfe/semi-ui'
import { IconPause, IconPlay, IconRefresh } from '@douyinfe/semi-icons'
import { useIsMobile } from '@/shared/hooks/useIsMobile'

const THEMES = {
  cyan:   { bg: '#050d1a', colors: ['#00d4ff', '#0099cc', '#004466', '#00ffcc'] },
  fire:   { bg: '#0d0500', colors: ['#ff6b00', '#ff3300', '#ffcc00', '#ff9900'] },
  purple: { bg: '#08050d', colors: ['#9b59b6', '#6c3483', '#d7bde2', '#c39bd3'] },
  green:  { bg: '#020d05', colors: ['#00ff88', '#00cc66', '#004d26', '#66ffb2'] },
}

export default function ParticleCanvasPage() {
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const particlesRef = useRef([])
  const mouseRef = useRef({ x: -9999, y: -9999 })
  const pausedRef = useRef(false)
  const settingsRef = useRef({ count: 120, linkDist: 130, theme: 'cyan', speed: 1 })

  const [paused, setPaused] = useState(false)
  const [theme, setTheme] = useState('cyan')
  const [count, setCount] = useState(120)
  const [linkDist, setLinkDist] = useState(130)
  const [speed, setSpeed] = useState(1)

  const initParticles = useCallback((canvas) => {
    const { count, theme } = settingsRef.current
    const colors = THEMES[theme].colors
    const particles = []
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        r: Math.random() * 2.5 + 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: Math.random() * 0.5 + 0.5,
      })
    }
    particlesRef.current = particles
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { theme, linkDist, speed } = settingsRef.current
    const { bg } = THEMES[theme]
    const mouse = mouseRef.current
    const particles = particlesRef.current

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Update + draw particles
    for (const p of particles) {
      if (!pausedRef.current) {
        // Mouse repulsion
        const dx = p.x - mouse.x
        const dy = p.y - mouse.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 100) {
          p.vx += (dx / dist) * 0.3
          p.vy += (dy / dist) * 0.3
        }
        // Speed clamp
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
        const maxSpd = 1.2 * speed
        if (spd > maxSpd) { p.vx = p.vx / spd * maxSpd; p.vy = p.vy / spd * maxSpd }

        p.x += p.vx * speed
        p.y += p.vy * speed

        if (p.x < 0) { p.x = 0; p.vx *= -1 }
        if (p.x > canvas.width) { p.x = canvas.width; p.vx *= -1 }
        if (p.y < 0) { p.y = 0; p.vy *= -1 }
        if (p.y > canvas.height) { p.y = canvas.height; p.vy *= -1 }
      }

      // Glow
      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3)
      grd.addColorStop(0, p.color)
      grd.addColorStop(1, 'transparent')
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2)
      ctx.fillStyle = grd
      ctx.fill()

      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fillStyle = p.color
      ctx.globalAlpha = p.opacity
      ctx.fill()
      ctx.globalAlpha = 1
    }

    // Draw links
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x
        const dy = particles[i].y - particles[j].y
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d < linkDist) {
          ctx.beginPath()
          ctx.moveTo(particles[i].x, particles[i].y)
          ctx.lineTo(particles[j].x, particles[j].y)
          ctx.strokeStyle = particles[i].color
          ctx.globalAlpha = (1 - d / linkDist) * 0.4
          ctx.lineWidth = 0.8
          ctx.stroke()
          ctx.globalAlpha = 1
        }
      }
    }

    animRef.current = requestAnimationFrame(draw)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      initParticles(canvas)
    }
    resize()
    window.addEventListener('resize', resize)
    animRef.current = requestAnimationFrame(draw)
    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animRef.current)
    }
  }, [draw, initParticles])

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }
  const handleMouseLeave = () => { mouseRef.current = { x: -9999, y: -9999 } }

  const applyTheme = (v) => { setTheme(v); settingsRef.current.theme = v; initParticles(canvasRef.current) }
  const applyCount = (v) => { setCount(v); settingsRef.current.count = v; initParticles(canvasRef.current) }
  const applyLinkDist = (v) => { setLinkDist(v); settingsRef.current.linkDist = v }
  const applySpeed = (v) => { setSpeed(v); settingsRef.current.speed = v }
  const togglePause = () => { pausedRef.current = !pausedRef.current; setPaused(p => !p) }
  const handleRefresh = () => initParticles(canvasRef.current)

  const bgColor = THEMES[theme].bg
  const isMobile = useIsMobile()

  return (
    <div style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', background: bgColor }}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 20, padding: isMobile ? '8px 12px' : '12px 20px', background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap' }}>
        <div style={{ flex: isMobile ? '1' : 'none' }}>
          <Typography.Title heading={5} style={{ margin: 0, color: '#fff', fontSize: isMobile ? 15 : undefined }}>粒子连线动画</Typography.Title>
          {!isMobile && <Typography.Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>HTML5 Canvas · 鼠标交互排斥</Typography.Text>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Typography.Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, whiteSpace: 'nowrap' }}>主题</Typography.Text>
          <Select value={theme} onChange={applyTheme} style={{ width: isMobile ? 80 : 100 }} size="small">
            <Select.Option value="cyan">赛博蓝</Select.Option>
            <Select.Option value="fire">熔岩橙</Select.Option>
            <Select.Option value="purple">星云紫</Select.Option>
            <Select.Option value="green">矩阵绿</Select.Option>
          </Select>
        </div>
        {!isMobile && <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 160 }}>
            <Typography.Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, whiteSpace: 'nowrap' }}>粒子 {count}</Typography.Text>
            <Slider value={count} min={30} max={300} step={10} onChange={applyCount} style={{ width: 100 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 160 }}>
            <Typography.Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, whiteSpace: 'nowrap' }}>连线 {linkDist}</Typography.Text>
            <Slider value={linkDist} min={60} max={250} step={10} onChange={applyLinkDist} style={{ width: 100 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 }}>
            <Typography.Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, whiteSpace: 'nowrap' }}>速度 {speed}x</Typography.Text>
            <Slider value={speed} min={0.2} max={3} step={0.2} onChange={applySpeed} style={{ width: 80 }} />
          </div>
        </>}
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <Button icon={paused ? <IconPlay /> : <IconPause />} onClick={togglePause} size="small">{paused ? '继续' : '暂停'}</Button>
          <Button icon={<IconRefresh />} onClick={handleRefresh} size="small">重置</Button>
        </div>
      </div>
      {/* Canvas */}
      <canvas ref={canvasRef} style={{ flex: 1, width: '100%', cursor: 'crosshair' }} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} />
    </div>
  )
}
