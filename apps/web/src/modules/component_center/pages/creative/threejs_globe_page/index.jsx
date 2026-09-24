import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Tag, Typography } from '@douyinfe/semi-ui'
import { useIsMobile } from '@/shared/hooks/useIsMobile'

const CITIES = [
  { name: '北京',   lat: 39.9,  lon: 116.4 },
  { name: '上海',   lat: 31.2,  lon: 121.5 },
  { name: '纽约',   lat: 40.7,  lon: -74.0 },
  { name: '伦敦',   lat: 51.5,  lon:  -0.1 },
  { name: '东京',   lat: 35.7,  lon: 139.7 },
  { name: '悉尼',   lat: -33.9, lon: 151.2 },
  { name: '迪拜',   lat: 25.2,  lon:  55.3 },
  { name: '巴黎',   lat: 48.9,  lon:   2.3 },
  { name: '新加坡', lat:  1.4,  lon: 103.8 },
  { name: '旧金山', lat: 37.8,  lon: -122.4 },
]

const ARC_PAIRS = [[0,1],[0,4],[1,2],[2,3],[3,7],[4,5],[5,6],[6,8],[7,9],[8,0]]

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
  const mountRef   = useRef(null)
  const [hovered, setHovered] = useState(null)
  const isMobile = useIsMobile()

  useEffect(() => {
    const mount = mountRef.current
    const W = mount.clientWidth, H = mount.clientHeight

    /* ── renderer ── */
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x020b18)
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

    /* ── globe group (所有地球相关对象都挂在这里，统一旋转) ── */
    const globeGroup = new THREE.Group()
    scene.add(globeGroup)

    // 球体
    const globeMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 64),
      new THREE.MeshPhongMaterial({
        color:     0x0a1f3a,
        emissive:  0x071525,
        specular:  0x1a4a6a,
        shininess: 12,
      })
    )
    globeGroup.add(globeMesh)

    // 经纬网格
    globeGroup.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.003, 36, 18),
      new THREE.MeshBasicMaterial({ color: 0x1a5580, wireframe: true, transparent: true, opacity: 0.18 })
    ))

    // 大气层（单面，稍大，向外）
    globeGroup.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.08, 64, 64),
      new THREE.MeshPhongMaterial({
        color: 0x0044aa, emissive: 0x001133,
        transparent: true, opacity: 0.12, side: THREE.FrontSide, depthWrite: false,
      })
    ))

    /* ── city dots + pulse rings (作为 globeGroup 子对象) ── */
    const dotGeo  = new THREE.SphereGeometry(0.013, 8, 8)
    const dotMat  = new THREE.MeshBasicMaterial({ color: 0x00d4ff })
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
        new THREE.MeshBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })
      )
      ring.position.copy(pos)
      // 朝向球心外
      ring.lookAt(pos.clone().multiplyScalar(2))
      ring.userData.phase = Math.random() * Math.PI * 2
      globeGroup.add(ring)
      rings.push(ring)
    }

    /* ── arc lines ── */
    for (const [a, b] of ARC_PAIRS) {
      const p1  = latLonToVec3(CITIES[a].lat, CITIES[a].lon, 1.0)
      const p2  = latLonToVec3(CITIES[b].lat, CITIES[b].lon, 1.0)
      const mid = p1.clone().add(p2).multiplyScalar(0.5).normalize().multiplyScalar(1.4)
      const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2)
      const arcGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(60))
      globeGroup.add(new THREE.Line(
        arcGeo,
        new THREE.LineBasicMaterial({ color: 0x0099ff, transparent: true, opacity: 0.35 })
      ))
    }

    /* ── lights ── */
    scene.add(new THREE.AmbientLight(0x334466, 3.5))
    const sun = new THREE.DirectionalLight(0x6699cc, 1.5)
    sun.position.set(4, 2, 4)
    scene.add(sun)
    // 背光（让暗面不全黑）
    const backLight = new THREE.DirectionalLight(0x001133, 0.8)
    backLight.position.set(-3, -1, -3)
    scene.add(backLight)

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

    // 收集可点击的 dots
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
        setHovered(hits[0].object.userData.name)
        renderer.domElement.style.cursor = 'pointer'
      } else {
        setHovered(null)
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
    }
  }, [])

  return (
    <div style={{ height: 'calc(100vh - 60px)', maxHeight: 600, background: '#020b18', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 20, left: 24, zIndex: 10, pointerEvents: 'none' }}>
        <Typography.Title heading={4} style={{ margin: 0, color: '#fff' }}>Three.js 3D 地球</Typography.Title>
        <Typography.Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>拖拽旋转 · 城市节点 · 数据连线</Typography.Text>
      </div>

      {hovered && (
        <div style={{ position: 'absolute', top: 20, right: 24, zIndex: 10, background: 'rgba(0,180,255,0.12)', border: '1px solid rgba(0,180,255,0.4)', borderRadius: 8, padding: '6px 16px', color: '#00d4ff', fontSize: 14, fontWeight: 600 }}>
          📍 {hovered}
        </div>
      )}

      <div style={{ position: 'absolute', bottom: isMobile ? 8 : 20, left: isMobile ? 8 : 24, right: isMobile ? 8 : 'auto', zIndex: 10, display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: isMobile ? '100%' : '60%' }}>
        {CITIES.map(c => (
          <Tag key={c.name} color={hovered === c.name ? 'blue' : 'grey'} size="small">{c.name}</Tag>
        ))}
      </div>

      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
