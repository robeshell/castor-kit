import { useCallback, useSyncExternalStore } from 'react'

/**
 * Responsive breakpoint hook
 * @param breakpoint - defaults to 768px
 * @returns isMobile
 */
export function useIsMobile(breakpoint = 768): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
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
