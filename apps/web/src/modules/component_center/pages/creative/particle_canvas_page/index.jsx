import { useCallback, useEffect, useRef, useState } from 'react'
import { MousePointer2, Pause, Play, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'

// Canvas-only colors (Ocean blue / cyan family), independent of the page theme; labels are translated when rendered
const THEMES = {
  ocean: { label: '海洋蓝', bg: '#040b18', colors: ['#2563eb', '#0ea5e9', '#22d3ee', '#60a5fa'] },
  glacier: { label: '冰川青', bg: '#03111a', colors: ['#22d3ee', '#67e8f9', '#0891b2', '#a5f3fc'] },
  abyss: { label: '深海蓝', bg: '#020617', colors: ['#1d4ed8', '#3b82f6', '#1e40af', '#93c5fd'] },
  lagoon: { label: '潟湖绿', bg: '#021312', colors: ['#14b8a6', '#2dd4bf', '#22d3ee', '#5eead4'] },
}

function ControlSlider({ label, value, display, min, max, step, onChange }) {
  return (
    <div className="flex min-w-[180px] flex-1 items-center gap-3">
      <span className="text-muted-foreground w-16 shrink-0 text-xs whitespace-nowrap">
        {label} <span className="text-foreground font-mono tabular-nums">{display ?? value}</span>
      </span>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} className="flex-1" />
    </div>
  )
}

export default function ParticleCanvasPage() {
  const { t } = useTranslation()
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const particlesRef = useRef([])
  const mouseRef = useRef({ x: -9999, y: -9999 })
  const pausedRef = useRef(false)
  const settingsRef = useRef({ count: 120, linkDist: 130, theme: 'ocean', speed: 1 })

  const [paused, setPaused] = useState(false)
  const [theme, setTheme] = useState('ocean')
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

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const draw = () => {
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
          if (spd > maxSpd) {
            p.vx = (p.vx / spd) * maxSpd
            p.vy = (p.vy / spd) * maxSpd
          }

          p.x += p.vx * speed
          p.y += p.vy * speed

          if (p.x < 0) {
            p.x = 0
            p.vx *= -1
          }
          if (p.x > canvas.width) {
            p.x = canvas.width
            p.vx *= -1
          }
          if (p.y < 0) {
            p.y = 0
            p.vy *= -1
          }
          if (p.y > canvas.height) {
            p.y = canvas.height
            p.vy *= -1
          }
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
    }

    const resize = () => {
      if (!canvas.offsetWidth || !canvas.offsetHeight) return
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      initParticles(canvas)
    }
    resize()
    // Sidebar collapse etc. also resize the canvas, so a ResizeObserver handles every case
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    animRef.current = requestAnimationFrame(draw)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(animRef.current)
    }
  }, [initParticles])

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }
  const handleMouseLeave = () => {
    mouseRef.current = { x: -9999, y: -9999 }
  }

  const applyTheme = (v) => {
    setTheme(v)
    settingsRef.current.theme = v
    initParticles(canvasRef.current)
  }
  const applyCount = (v) => {
    setCount(v)
    settingsRef.current.count = v
    initParticles(canvasRef.current)
  }
  const applyLinkDist = (v) => {
    setLinkDist(v)
    settingsRef.current.linkDist = v
  }
  const applySpeed = (v) => {
    setSpeed(v)
    settingsRef.current.speed = v
  }
  const togglePause = () => {
    pausedRef.current = !pausedRef.current
    setPaused((p) => !p)
  }
  const handleRefresh = () => initParticles(canvasRef.current)

  return (
    <div className="space-y-5">
      <PageHeader
        title="粒子连线动画"
        actions={
          <>
            <Button size="sm" variant="outline" onClick={togglePause}>
              {paused ? <Play /> : <Pause />}
              {paused ? t('继续') : t('暂停')}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleRefresh}>
              <RotateCcw />
              {t('重置')}
            </Button>
          </>
        }
      />

      <Panel bodyClassName="flex flex-wrap items-center gap-x-6 gap-y-4 p-4">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">{t('主题')}</span>
          <Select value={theme} onValueChange={applyTheme}>
            <SelectTrigger size="sm" className="h-8 w-[112px] text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(THEMES).map(([key, item]) => (
                <SelectItem key={key} value={key}>
                  <span className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: `linear-gradient(135deg, ${item.colors[0]}, ${item.colors[2]})` }} />
                    {t(item.label)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ControlSlider label={t('粒子')} value={count} min={30} max={300} step={10} onChange={applyCount} />
        <ControlSlider label={t('连线')} value={linkDist} min={60} max={250} step={10} onChange={applyLinkDist} />
        <ControlSlider label={t('速度')} value={speed} display={`${speed.toFixed(1)}x`} min={0.2} max={3} step={0.2} onChange={applySpeed} />
      </Panel>

      <section className="surface-card relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="block h-[440px] w-full cursor-crosshair bg-black md:h-[600px]"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
        <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-1 text-[11px] text-white/60 ring-1 ring-white/10 backdrop-blur-sm">
          <MousePointer2 className="size-3" />
          {t('移动鼠标，粒子会被推开')}
        </div>
      </section>
    </div>
  )
}
