import { useEffect, useRef } from 'react'
import './login-backdrop.css'

/**
 * Animated login backdrop (see login-backdrop.css): aurora blobs + panning grid + pointer spotlight.
 * The spotlight follows the pointer through CSS variables updated at most once per frame;
 * it is not wired up for touch-only devices or when the user prefers reduced motion.
 */
export default function LoginBackdrop() {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const finePointer = window.matchMedia?.('(pointer: fine)').matches
    if (!el || reduced || !finePointer) return undefined

    let frame = 0
    let x = 0
    let y = 0
    const apply = () => {
      frame = 0
      el.style.setProperty('--spot-x', `${x}px`)
      el.style.setProperty('--spot-y', `${y}px`)
      el.style.setProperty('--spot-opacity', '1')
    }
    const onMove = (event) => {
      const rect = el.getBoundingClientRect()
      x = event.clientX - rect.left
      y = event.clientY - rect.top
      if (!frame) frame = requestAnimationFrame(apply)
    }
    const onLeave = () => el.style.setProperty('--spot-opacity', '0')

    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return (
    <div ref={ref} aria-hidden className="login-backdrop pointer-events-none absolute inset-0 overflow-hidden">
      <div className="login-aurora login-aurora-1" />
      <div className="login-aurora login-aurora-2" />
      <div className="login-aurora login-aurora-3" />
      <div className="login-grid" />
      <div className="login-grid-glow" />
      <div className="login-spotlight" />
    </div>
  )
}
