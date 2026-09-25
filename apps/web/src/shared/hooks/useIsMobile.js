import { useCallback, useSyncExternalStore } from 'react'

/**
 * Responsive breakpoint hook
 * @param {number} breakpoint - defaults to 768px
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
