import { useCallback, useSyncExternalStore } from 'react'

/**
 * 响应式断点 hook
 * @param {number} breakpoint - 默认 768px
 * @returns {boolean} isMobile
 */
export function useIsMobile(breakpoint = 768) {
  const subscribe = useCallback(
    (callback) => {
      const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
      mq.addEventListener('change', callback)
      return () => mq.removeEventListener('change', callback)
    },
    [breakpoint],
  )
  return useSyncExternalStore(
    subscribe,
    () => window.innerWidth < breakpoint,
    () => false,
  )
}
