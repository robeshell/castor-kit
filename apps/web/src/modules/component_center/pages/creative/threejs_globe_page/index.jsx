import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Hand, MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { mixHex, useChartColors } from '@/lib/chart-theme'
import { cn } from '@/lib/utils'
import PageHeader from '@/shared/components/PageHeader'
import { CITIES } from '@/modules/component_center/pages/creative/threejs_globe_page/demo-content'

const ARC_PAIRS = [[0,1],[0,4],[1,2],[2,3],[3,7],[4,5],[5,6],[6,8],[7,9],[8,0]]

/** Scene colors derived from the accent stops (brand-from / via / to); the scene itself stays dark in both themes */
function globePalette(c) {
  const [from, via, to] = [c['brand-from'], c['brand-via'], c['brand-to']]
  return {
    background: mixHex(from, '#020617', 0.06),
    globe: mixHex(from, '#020617', 0.2),
    globeEmissive: mixHex(from, '#000000', 0.1),
    globeSpecular: mixHex(via, '#020617', 0.45),
    grid: via,
    atmosphere: from,
    atmosphereEmissive: mixHex(from, '#000000', 0.12),
    city: to,
    arc: mixHex(via, to, 0.5),
    ambient: mixHex(from, '#1e293b', 0.25),
    sun: mixHex(from, '#ffffff', 0.55),
    backLight: mixHex(from, '#000000', 0.12),
  }
}

/** Recolor an existing scene (called on mount and whenever the accent changes) */
function applyPalette(parts, p) {
  parts.renderer.setClearColor(p.background)
  parts.globeMat.color.set(p.globe)
  parts.globeMat.emissive.set(p.globeEmissive)
  parts.globeMat.specular.set(p.globeSpecular)
  parts.gridMat.color.set(p.grid)
  parts.atmosphereMat.color.set(p.atmosphere)
  parts.atmosphereMat.emissive.set(p.atmosphereEmissive)
  parts.dotMat.color.set(p.city)
  parts.ringMats.forEach((m) => m.color.set(p.city))
  parts.arcMats.forEach((m) => m.color.set(p.arc))
  parts.ambient.color.set(p.ambient)
  parts.sun.color.set(p.sun)
  parts.backLight.color.set(p.backLight)
}

function latLonToVec3(lat, lon, r = 1) {
  const phi   = (90 - lat)  * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  )
}

export default function ThreejsGlobePage() {
  const { t } = useTranslation()
  const mountRef   = useRef(null)
  const hoveredRef = useRef(null)
  const [hovered, setHovered] = useState(null)
  const chartColors = useChartColors()
  const palette = useMemo(() => globePalette(chartColors), [chartColors])
  const partsRef = useRef(null) // materials / lights that follow the accent

  useEffect(() => {
    const mount = mountRef.current
    const W = mount.clientWidth, H = mount.clientHeight

    /* ── renderer ── */
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    /* ── scene / camera ── */
    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 500)
    camera.position.z = 3.2

    /* ── stars ── */
    const starVerts = []
    for (let i = 0; i < 4000; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi   = Math.acos(2 * Math.random() - 1)
      const r     = 80 + Math.random() * 120
      starVerts.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta),
      )
    }
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3))
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, sizeAttenuation: true })))

    /* ── globe group (every globe object hangs here and rotates together) ── */
    const globeGroup = new THREE.Group()
    scene.add(globeGroup)

    // Sphere
    // Colors are filled in by applyPalette
    const globeMat = new THREE.MeshPhongMaterial({ shininess: 12 })
    const globeMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), globeMat)
    globeGroup.add(globeMesh)

    // Lat / lon grid
    const gridMat = new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.12 })
    globeGroup.add(new THREE.Mesh(new THREE.SphereGeometry(1.003, 36, 18), gridMat))

    // Atmosphere (single-sided, slightly larger, facing outward)
    const atmosphereMat = new THREE.MeshPhongMaterial({ transparent: true, opacity: 0.12, side: THREE.FrontSide, depthWrite: false })
    globeGroup.add(new THREE.Mesh(new THREE.SphereGeometry(1.08, 64, 64), atmosphereMat))

    /* ── city dots + pulse rings (children of globeGroup) ── */
    const dotGeo  = new THREE.SphereGeometry(0.013, 8, 8)
    const dotMat  = new THREE.MeshBasicMaterial()
    const ringGeo = new THREE.RingGeometry(0.018, 0.03, 24)
    const rings   = []

    for (const city of CITIES) {
      const pos = latLonToVec3(city.lat, city.lon, 1.015)

      const dot = new THREE.Mesh(dotGeo, dotMat)
      dot.position.copy(pos)
      dot.userData = { name: city.name }
      globeGroup.add(dot)

      const ring = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })
      )
      ring.position.copy(pos)
      // Face away from the globe center
      ring.lookAt(pos.clone().multiplyScalar(2))
      ring.userData.phase = Math.random() * Math.PI * 2
      globeGroup.add(ring)
      rings.push(ring)
    }

    /* ── arc lines ── */
    const arcMats = []
    for (const [a, b] of ARC_PAIRS) {
      const p1  = latLonToVec3(CITIES[a].lat, CITIES[a].lon, 1.0)
      const p2  = latLonToVec3(CITIES[b].lat, CITIES[b].lon, 1.0)
      const mid = p1.clone().add(p2).multiplyScalar(0.5).normalize().multiplyScalar(1.4)
      const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2)
      const arcGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(60))
      const arcMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.35 })
      arcMats.push(arcMat)
      globeGroup.add(new THREE.Line(arcGeo, arcMat))
    }

    /* ── lights ── */
    const ambient = new THREE.AmbientLight(0xffffff, 3.5)
    scene.add(ambient)
    const sun = new THREE.DirectionalLight(0xffffff, 1.5)
    sun.position.set(4, 2, 4)
    scene.add(sun)
    // Back light (keeps the dark side from going fully black)
    const backLight = new THREE.DirectionalLight(0xffffff, 0.8)
    backLight.position.set(-3, -1, -3)
    scene.add(backLight)

    partsRef.current = {
      renderer, globeMat, gridMat, atmosphereMat, dotMat, arcMats, ambient, sun, backLight,
      ringMats: rings.map((r) => r.material),
    }

    /* ── drag ── */
    let dragging = false, prevX = 0, prevY = 0, velX = 0, velY = 0
    const onDown = e => { dragging = true; prevX = e.clientX; prevY = e.clientY; velX = velY = 0 }
    const onUp   = () => { dragging = false }
    const onMove = e => {
      if (!dragging) return
      velX += (e.clientX - prevX) * 0.005
      velY += (e.clientY - prevY) * 0.004
      prevX = e.clientX; prevY = e.clientY
    }
    renderer.domElement.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup',    onUp)
    window.addEventListener('mousemove',  onMove)

    /* ── raycaster for hover ── */
    const raycaster = new THREE.Raycaster()
    raycaster.params.Points.threshold = 0.05
    const pointer = new THREE.Vector2(-99, -99)
    const onPointerMove = e => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
      pointer.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1
    }
    renderer.domElement.addEventListener('mousemove', onPointerMove)

    // Collect the hoverable dots
    const dotMeshes = globeGroup.children.filter(c => c.userData?.name)

    /* ── animate ── */
    let frame = 0, raf
    const animate = () => {
      raf = requestAnimationFrame(animate)
      frame++

      if (!dragging) velX += 0.0025
      velX *= 0.96; velY *= 0.94
      globeGroup.rotation.y += velX
      globeGroup.rotation.x = Math.max(-0.6, Math.min(0.6, globeGroup.rotation.x + velY))

      // pulse rings
      const t = frame * 0.04
      for (const ring of rings) {
        const s = 1 + 0.6 * ((Math.sin(t + ring.userData.phase) + 1) / 2)
        ring.scale.setScalar(s)
        ring.material.opacity = 0.7 * (1 - (s - 1) / 0.6)
      }

      // hover detection
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(dotMeshes)
      if (hits.length) {
        const name = hits[0].object.userData.name
        // Only update state when the hovered city changes, so we don't re-render every frame
        if (hoveredRef.current !== name) {
          hoveredRef.current = name
          setHovered(name)
        }
        renderer.domElement.style.cursor = 'pointer'
      } else {
        if (hoveredRef.current !== null) {
          hoveredRef.current = null
          setHovered(null)
        }
        renderer.domElement.style.cursor = dragging ? 'grabbing' : 'grab'
      }

      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight
      camera.aspect = w / h; camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mouseup',   onUp)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('resize',    onResize)
      renderer.domElement.removeEventListener('mousedown', onDown)
      renderer.domElement.removeEventListener('mousemove', onPointerMove)
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
      renderer.dispose()
      partsRef.current = null
    }
  }, [])

  // Runs after the scene effect above on mount, and again whenever the accent (or light / dark) changes
  useEffect(() => {
    if (partsRef.current) applyPalette(partsRef.current, palette)
  }, [palette])

  return (
    <div className="space-y-5">
      <PageHeader title="Three.js 3D 地球" />

      <section className="surface-card relative overflow-hidden">
        <div ref={mountRef} className="h-[460px] w-full bg-black md:h-[600px]" />

        <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-1 text-[11px] text-white/60 ring-1 ring-white/10 backdrop-blur-sm">
          <Hand className="size-3" />
          {t('拖拽旋转地球')}
        </div>

        {hovered ? (
          <div className="animate-in fade-in-0 zoom-in-95 absolute top-3 right-3 flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white ring-1 ring-white/20 backdrop-blur-md duration-150">
            <MapPin className="text-brand-to size-4" />
            {hovered}
          </div>
        ) : null}

        <div className="pointer-events-none absolute right-3 bottom-3 left-3 flex flex-wrap gap-1.5 md:right-auto md:max-w-[60%]">
          {CITIES.map((c) => (
            <span
              key={c.name}
              className={cn(
                'rounded-md px-2 py-0.5 text-[11px] ring-1 backdrop-blur-sm transition-colors duration-150',
                hovered === c.name ? 'bg-brand-to/25 text-white ring-brand-to/60' : 'bg-white/5 text-white/60 ring-white/10',
              )}
            >
              {c.name}
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}
