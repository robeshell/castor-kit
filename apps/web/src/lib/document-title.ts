import { useEffect } from 'react'
import { APP_NAME } from '@/lib/brand'

export const APP_TITLE = APP_NAME

/**
 * Sets the document title to "<page> · <app name>" (most specific first) so each route announces itself
 * and browser tabs / history stay distinguishable. A null or empty title leaves the current one alone.
 */
export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    if (title) document.title = `${title} · ${APP_TITLE}`
  }, [title])
}
