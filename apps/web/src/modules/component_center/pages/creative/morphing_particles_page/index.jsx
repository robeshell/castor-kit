import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Play, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { EASE_OUT } from '@/lib/motion'
import { cn } from '@/lib/utils'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'
import SegmentedTabs from '@/shared/components/SegmentedTabs'

const PARTICLE_COUNT = 18000

const SHAPES = ['sphere', 'torus', 'dna', 'galaxy', 'cube']
// Labels keep the Chinese source text and are translated when rendered
const SHAPE_LABELS = { sphere: '球体', torus: '环面', dna: 'DNA 螺旋', galaxy: '星系', cube: '立方体' }

// WebGL vertex colors (0–1 RGB), Ocean blue / cyan family
const PALETTES = [
  { name: '海洋', colors: [[0.15, 0.39, 0.92], [0.01, 0.52, 0.78], [0.13, 0.83, 0.93]] },
  { name: '冰川', colors: [[0.13, 0.83, 0.93], [0.65, 0.95, 0.99], [0.22, 0.74, 0.97]] },
  { name: '潟湖', colors: [[0.08, 0.72, 0.65], [0.18, 0.83, 0.75], [0.13, 0.83, 0.93]] },
]

function paletteSwatch(p) {
  const [a, , c] = p.colors.map(([r, g, b]) => `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`)
  return `linear-gradient(90deg, ${a}, ${c})`
}

function getShapePositions(shape, count) {
  const pos = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    let x, y, z
    if (shape === 'sphere') {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 1 + (Math.random() - 0.5) * 0.15
      x = r * Math.sin(phi) * Math.cos(theta)
      y = r * Math.cos(phi)
      z = r * Math.sin(phi) * Math.sin(theta)
    } else if (shape === 'torus') {
      const u = Math.random() * Math.PI * 2
      const v = Math.random() * Math.PI * 2
      const R = 1.2, r2 = 0.4 + (Math.random() - 0.5) * 0.1
      x = (R + r2 * Math.cos(v)) * Math.cos(u)
      y = r2 * Math.sin(v) * 1.2
      z = (R + r2 * Math.cos(v)) * Math.sin(u)
    } else if (shape === 'dna') {
      const t = (i / count) * Math.PI * 16 - Math.PI * 8
      const strand = i % 2 === 0 ? 0 : Math.PI
      const r2 = 0.6
      x = r2 * Math.cos(t + strand) + (Math.random() - 0.5) * 0.06
      y = t * 0.18
      z = r2 * Math.sin(t + strand) + (Math.random() - 0.5) * 0.06
    } else if (shape === 'galaxy') {
      const arm = Math.floor(Math.random() * 3)
      const r2 = Math.pow(Math.random(), 0.5) * 2.0
      const angle = arm * (Math.PI * 2 / 3) + r2 * 1.8 + (Math.random() - 0.5) * 0.5
      x = r2 * Math.cos(angle) + (Math.random() - 0.5) * 0.2
      y = (Math.random() - 0.5) * 0.15 * (1 - r2 / 2.2)
      z = r2 * Math.sin(angle) + (Math.random() - 0.5) * 0.2
    } else { // cube
      const face = Math.floor(Math.random() * 6)
      const a = (Math.random() - 0.5) * 2
      const b = (Math.random() - 0.5) * 2
      const faces = [[1,a,b],[-1,a,b],[a,1,b],[a,-1,b],[a,b,1],[a,b,-1]]
      ;[x, y, z] = faces[face].map(v => v * 1.0)
    }
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z
  }
  return pos
}

function getColors(palette, count) {
  const cols = new Float32Array(count * 3)
  const p = PALETTES[palette].colors
  for (let i = 0; i < count; i++) {
    const t = i / count
    const ci = Math.floor(t * (p.length - 1))
    const ct = t * (p.length - 1) - ci
    const c1 = p[ci], c2 = p[Math.min(ci + 1, p.length - 1)]
    cols[i * 3]     = c1[0] + (c2[0] - c1[0]) * ct
    cols[i * 3 + 1] = c1[1] + (c2[1] - c1[1]) * ct
    cols[i * 3 + 2] = c1[2] + (c2[2] - c1[2]) * ct
  }
  return cols
}

export default function MorphingParticlesPage() {
  const { t } = useTranslation()
  const mountRef = useRef(null)
  const stateRef = useRef({ shapeIdx: 0, paletteIdx: 0, auto: true, morphT: 1.0 })
  const [shapeIdx, setShapeIdx] = useState(0)
  const [paletteIdx, setPaletteIdx] = useState(0)
  const [morphing, setMorphing] = useState(false)

  useEffect(() => {
    const mount = mountRef.current
    const w = mount.clientWidth, h = mount.clientHeight

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, w / h, 0.01, 100)
    camera.position.z = 3.5

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 1)
    mount.appendChild(renderer.domElement)

    const geo = new THREE.BufferGeometry()
    let fromPos = getShapePositions('sphere', PARTICLE_COUNT)
    let toPos   = fromPos.slice()
    const curPos = fromPos.slice()
    const colors = getColors(0, PARTICLE_COUNT)

    geo.setAttribute('position', new THREE.BufferAttribute(curPos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const mat = new THREE.PointsMaterial({
      size: 0.012,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const points = new THREE.Points(geo, mat)
    scene.add(points)

    let morphT = 1.0
    let autoTimer = null

    function startMorph(newIdx) {
      const s = stateRef.current
      fromPos = curPos.slice()
      toPos = getShapePositions(SHAPES[newIdx], PARTICLE_COUNT)
      morphT = 0
      s.shapeIdx = newIdx
      setShapeIdx(newIdx)
      setMorphing(true)

      // Update colors
      const newColors = getColors(s.paletteIdx, PARTICLE_COUNT)
      geo.attributes.color.array.set(newColors)
      geo.attributes.color.needsUpdate = true
    }

    // Expose to buttons
    stateRef.current.startMorph = startMorph
    // Palette changes apply immediately (no need to wait for the next morph)
    stateRef.current.applyPalette = (idx) => {
      geo.attributes.color.array.set(getColors(idx, PARTICLE_COUNT))
      geo.attributes.color.needsUpdate = true
    }

    function scheduleAuto() {
      clearTimeout(autoTimer)
      autoTimer = setTimeout(() => {
        if (stateRef.current.auto) {
          const next = (stateRef.current.shapeIdx + 1) % SHAPES.length
          startMorph(next)
        }
      }, 3500)
    }
    scheduleAuto()

    // Mouse drag
    let isDragging = false, lastX = 0, lastY = 0, velX = 0, velY = 0
    const onDown = e => { isDragging = true; lastX = e.clientX; lastY = e.clientY }
    const onUp = () => { isDragging = false }
    const onMove = e => {
      if (!isDragging) return
      velX += (e.clientX - lastX) * 0.004
      velY += (e.clientY - lastY) * 0.003
      lastX = e.clientX; lastY = e.clientY
    }
    renderer.domElement.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('mousemove', onMove)

    let frame = 0
    let raf
    const animate = () => {
      raf = requestAnimationFrame(animate)
      frame++

      // Morph
      if (morphT < 1) {
        morphT = Math.min(1, morphT + 0.012)
        const ease = morphT < 0.5 ? 4 * morphT * morphT * morphT : 1 - Math.pow(-2 * morphT + 2, 3) / 2
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          curPos[i * 3]     = fromPos[i * 3]     + (toPos[i * 3]     - fromPos[i * 3])     * ease
          curPos[i * 3 + 1] = fromPos[i * 3 + 1] + (toPos[i * 3 + 1] - fromPos[i * 3 + 1]) * ease
          curPos[i * 3 + 2] = fromPos[i * 3 + 2] + (toPos[i * 3 + 2] - fromPos[i * 3 + 2]) * ease
        }
        geo.attributes.position.needsUpdate = true
        if (morphT >= 1) {
          setMorphing(false)
          scheduleAuto()
        }
      }

      // Rotate
      if (!isDragging) { velX += 0.003; velY *= 0.95 }
      velX *= 0.96
      points.rotation.y += velX
      points.rotation.x += velY

      // Color pulse
      const t = frame * 0.01
      mat.opacity = 0.75 + Math.sin(t) * 0.1
      mat.size = 0.012 + Math.sin(t * 0.7) * 0.002

      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      const w2 = mount.clientWidth, h2 = mount.clientHeight
      camera.aspect = w2 / h2; camera.updateProjectionMatrix()
      renderer.setSize(w2, h2)
    }
    window.addEventListener('resize', onResize)

    return () => {
      clearTimeout(autoTimer)
      cancelAnimationFrame(raf)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('mousedown', onDown)
      mount.removeChild(renderer.domElement)
      renderer.dispose()
      geo.dispose()
      mat.dispose()
    }
  }, [])

  const handleShape = (idx) => {
    stateRef.current.auto = false
    stateRef.current.startMorph?.(idx)
  }

  const handlePalette = (idx) => {
    stateRef.current.paletteIdx = idx
    stateRef.current.applyPalette?.(idx)
    setPaletteIdx(idx)
  }

  const handleAuto = () => {
    stateRef.current.auto = true
    const next = (stateRef.current.shapeIdx + 1) % SHAPES.length
    stateRef.current.startMorph?.(next)
  }

  return (
    <div className="space-y-5">
      <PageHeader title="粒子形态变换" />

      <Panel bodyClassName="flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs">{t('形态')}</span>
          <SegmentedTabs
            variant="pill"
            value={SHAPES[shapeIdx]}
            onChange={(v) => handleShape(SHAPES.indexOf(v))}
            items={SHAPES.map((s) => ({ value: s, label: SHAPE_LABELS[s] }))}
          />
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleAuto}>
            <Play />
            {t('自动')}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">{t('配色')}</span>
          {PALETTES.map((p, i) => (
            <button
              key={p.name}
              type="button"
              onClick={() => handlePalette(i)}
              className={cn(
                'flex h-7 items-center gap-1.5 rounded-md px-2 text-xs ring-1 transition-colors duration-150',
                paletteIdx === i ? 'bg-brand-soft text-foreground ring-primary/40' : 'text-muted-foreground hover:text-foreground ring-border',
              )}
            >
              <span className="h-2 w-5 rounded-full" style={{ background: paletteSwatch(p) }} />
              {t(p.name)}
            </button>
          ))}
        </div>
      </Panel>

      <section className="surface-card relative overflow-hidden">
        <div ref={mountRef} className="h-[460px] w-full cursor-grab bg-black active:cursor-grabbing md:h-[600px]" />

        <div className="pointer-events-none absolute top-3 right-3 rounded-xl bg-white/5 px-4 py-2.5 text-right ring-1 ring-white/10 backdrop-blur-md">
          <div className="text-[11px] text-white/40">{t('当前形态')}</div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={shapeIdx}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              className="text-lg font-semibold text-white"
            >
              {t(SHAPE_LABELS[SHAPES[shapeIdx]])}
            </motion.div>
          </AnimatePresence>
          <div className={cn('text-brand-to flex items-center justify-end gap-1 text-[11px] transition-opacity duration-200', morphing ? 'opacity-100' : 'opacity-0')}>
            <Sparkles className="size-3" />
            {t('变形中...')}
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-white/5 px-2 py-1 text-[11px] text-white/50 ring-1 ring-white/10 backdrop-blur-sm">
          {t('拖拽旋转 · 点击上方切换形态')}
        </div>
      </section>
    </div>
  )
}
