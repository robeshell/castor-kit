import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { STATIC_TITLES, findActiveMenu, flattenMenus } from '@/components/app/menu-tree'
import { menuLabel } from '@/lib/menu-label'

/** One breadcrumb: an ancestor, or the current page */
export interface Crumb {
  name: string
  current?: boolean
}

/** The current route's menu ancestors plus the page itself (translated); empty for routes outside the menu */
export function usePageTrail(): Crumb[] {
  const { t } = useTranslation()
  const { menus } = useAuth()
  const { pathname } = useLocation()
  return useMemo<Crumb[]>(() => {
    const active = findActiveMenu(flattenMenus(menus), pathname)
    if (active) return [...active.parents.map((p) => ({ name: menuLabel(p) })), { name: menuLabel(active), current: true }]
    const title = STATIC_TITLES[pathname]
    return title ? [{ name: t(title), current: true }] : []
  }, [menus, pathname, t])
}
