import { useCallback, useRef, useState, type RefCallback } from 'react'

/**
 * Whether an element's content overflows it (it scrolls). A scroll area has to be focusable so keyboard users can
 * scroll it, but only while it actually scrolls: a tab stop on a box that fits its content is just noise.
 *   const [ref, scrollable] = useIsScrollable<HTMLDivElement>()
 *   <div ref={ref} tabIndex={scrollable ? 0 : undefined} className="overflow-x-auto">…</div>
 */
export function useIsScrollable<T extends HTMLElement>(): [RefCallback<T>, boolean] {
  const [scrollable, setScrollable] = useState(false)
  const observer = useRef<ResizeObserver | null>(null)
  const ref = useCallback<RefCallback<T>>((el) => {
    observer.current?.disconnect()
    observer.current = null
    if (!el) return
    const check = () => setScrollable(el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
    check()
    if (typeof ResizeObserver === 'undefined') return
    observer.current = new ResizeObserver(check)
    observer.current.observe(el)
    // The content resizing (rows loaded, columns added) changes the overflow without resizing the box itself
    Array.from(el.children).forEach((child) => observer.current?.observe(child))
  }, [])
  return [ref, scrollable]
}
