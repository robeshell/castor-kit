import { useCallback, useRef, useState, type CSSProperties, type RefCallback } from 'react'

/**
 * A horizontal scroller with a hidden scrollbar gives no cue that more items sit off-screen. This fades the edge
 * (a CSS mask) on each side that has more content, and updates as the element scrolls or resizes.
 *   const [ref, fade] = useOverflowFade<HTMLElement>()
 *   <nav ref={ref} style={fade} className="overflow-x-auto [scrollbar-width:none]">…</nav>
 */
export function useOverflowFade<T extends HTMLElement>(size = 24): [RefCallback<T>, CSSProperties | undefined] {
  const [edges, setEdges] = useState({ start: false, end: false })
  const cleanup = useRef<(() => void) | null>(null)
  const ref = useCallback<RefCallback<T>>((el) => {
    cleanup.current?.()
    cleanup.current = null
    if (!el) return
    const update = () => {
      const start = el.scrollLeft > 1
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
      setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }))
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(el)
    // Items added or removed (tabs opened / closed) change the scroll width without resizing the box
    const mutations = new MutationObserver(update)
    mutations.observe(el, { childList: true, subtree: true })
    cleanup.current = () => {
      el.removeEventListener('scroll', update)
      observer?.disconnect()
      mutations.disconnect()
    }
  }, [])
  if (!edges.start && !edges.end) return [ref, undefined]
  const mask = `linear-gradient(to right, ${edges.start ? 'transparent' : 'black'}, black ${size}px, black calc(100% - ${size}px), ${edges.end ? 'transparent' : 'black'})`
  return [ref, { maskImage: mask, WebkitMaskImage: mask }]
}
