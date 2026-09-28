import { useEffect } from 'react'

export const APP_TITLE = 'castor-kit'

/**
 * Sets the document title to "<page> · castor-kit" (most specific first) so each route announces itself
 * and browser tabs / history stay distinguishable. A null or empty title leaves the current one alone.
 */
export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    if (title) document.title = `${title} · ${APP_TITLE}`
  }, [title])
}
