import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useIsMobile } from '@/shared/hooks/useIsMobile'

const PARTICLE_COUNT = 18000

const SHAPES = ['sphere', 'torus', 'dna', 'galaxy', 'cube']
const SHAPE_LABELS = { sphere: '球体', torus: '环面', dna: 'DNA 螺旋', galaxy: '星系', cube: '立方体' }

const PALETTES = [
  { name: '极光', colors: [[0.0, 0.8, 1.0], [0.4, 0.2, 0.9], [0.0, 1.0, 0.6]] },
  { name: '熔岩', colors: [[1.0, 0.2, 0.0], [1.0, 0.6, 0.0], [1.0, 1.0, 0.2]] },
  { name: '星云', colors: [[0.8, 0.0, 1.0], [0.2, 0.0, 0.8], [1.0, 0.4, 0.8]] },
]

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
  const mountRef = useRef(null)
  const stateRef = useRef({ shapeIdx: 0, paletteIdx: 0, auto: true, morphT: 1.0 })
  const [shapeIdx, setShapeIdx] = useState(0)
  const [paletteIdx, setPaletteIdx] = useState(0)
  const [morphing, setMorphing] = useState(false)
  const isMobile = useIsMobile()

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

    let morphT = 1.0, isMorphing = false
    let autoTimer = null

    function startMorph(newIdx) {
      const s = stateRef.current
      fromPos = curPos.slice()
      toPos = getShapePositions(SHAPES[newIdx], PARTICLE_COUNT)
      morphT = 0
      isMorphing = true
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
          isMorphing = false
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
    setPaletteIdx(idx)
  }

  const handleAuto = () => {
    stateRef.current.auto = true
    const next = (stateRef.current.shapeIdx + 1) % SHAPES.length
    stateRef.current.startMorph?.(next)
  }

  return (
    <div style={{ height: 'calc(100vh - 60px)', background: '#000', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {/* Title */}
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, pointerEvents: 'none' }}>
        <div style={{ fontSize: isMobile ? 15 : 22, fontWeight: 800, color: '#fff', letterSpacing: isMobile ? 1 : 2 }}>MORPHING PARTICLES</div>
        {!isMobile && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
          {PARTICLE_COUNT.toLocaleString()} 粒子 · Three.js · 流体形态变换
        </div>}
      </div>

      {/* Shape state */}
      {!isMobile && (
        <div style={{ position: 'absolute', top: 20, right: 24, zIndex: 10 }}>
          <div style={{
            background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
            padding: '10px 16px', textAlign: 'right',
          }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>当前形态</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{SHAPE_LABELS[SHAPES[shapeIdx]]}</div>
            {morphing && <div style={{ fontSize: 11, color: '#00d4ff', marginTop: 2 }}>变形中...</div>}
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 'calc(100vw - 32px)', maxWidth: 520 }}>
        {/* Shape buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
          {SHAPES.map((s, i) => (
            <button key={s} onClick={() => handleShape(i)} style={{
              padding: isMobile ? '6px 12px' : '8px 18px', borderRadius: 24, border: 'none', cursor: 'pointer', fontSize: isMobile ? 12 : 13, fontWeight: 600,
              background: shapeIdx === i ? 'rgba(0,212,255,0.8)' : 'rgba(255,255,255,0.08)',
              color: shapeIdx === i ? '#000' : 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.2s',
              boxShadow: shapeIdx === i ? '0 0 20px rgba(0,212,255,0.5)' : 'none',
            }}>
              {SHAPE_LABELS[s]}
            </button>
          ))}
          <button onClick={handleAuto} style={{
            padding: isMobile ? '6px 12px' : '8px 18px', borderRadius: 24, border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer',
            fontSize: isMobile ? 12 : 13, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(8px)',
          }}>
            自动 ▶
          </button>
        </div>
        {/* Palette */}
        <div style={{ display: 'flex', gap: 8 }}>
          {PALETTES.map((p, i) => (
            <button key={p.name} onClick={() => handlePalette(i)} style={{
              padding: '4px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12,
              background: i === 0
                ? 'linear-gradient(90deg,#00ccff,#9900ff)'
                : i === 1
                ? 'linear-gradient(90deg,#ff3300,#ffcc00)'
                : 'linear-gradient(90deg,#cc00ff,#ff44aa)',
              color: '#fff', fontWeight: 600,
              opacity: paletteIdx === i ? 1 : 0.45,
              boxShadow: paletteIdx === i ? '0 0 12px rgba(255,255,255,0.3)' : 'none',
              transition: 'all 0.2s',
            }}>
              {p.name}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>拖拽旋转 · 点击切换形态</div>
      </div>

      <div ref={mountRef} style={{ flex: 1, width: '100%' }} />
    </div>
  )
}
