import { useSyncExternalStore } from 'react'

const MOBILE_BREAKPOINT = 768

function subscribe(callback) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}

/** Used by the shadcn sidebar: viewport width < 768px counts as mobile */
export function useIsMobile() {
  return useSyncExternalStore(
    subscribe,
    () => window.innerWidth < MOBILE_BREAKPOINT,
    () => false,
  )
}
