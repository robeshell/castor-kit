import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth, type MenuNode } from '@/context/AuthContext'
import { STATIC_TITLES, findActiveMenu, flattenMenus, navigablePages } from '@/components/app/menu-tree'

/**
 * Tags view state: the pages the user has opened, shown as tabs under the top bar.
 * - A tab is keyed by pathname; fullPath keeps the last search string so switching back restores it
 * - Root-level pages (e.g. the dashboard) are affixed: always first, never closable
 * - Only known pages (a menu or STATIC_TITLES) become tabs; the list lives in sessionStorage (per browser tab)
 * - versions[path] is bumped by refresh(); AppLayout keys the page on it to remount it
 */
/** An opened page as stored: pathname plus the full path (with search) to go back to */
export interface StoredTab {
  path: string
  fullPath: string
}

export interface Tab extends StoredTab {
  /** Root-level page: always first, never closable */
  affix: boolean
}

export interface TagsViewContextValue {
  tabs: Tab[]
  activePath: string
  /** Bumped by refresh(path); key the page on it to remount it */
  versions: Partial<Record<string, number>>
  close: (path: string) => void
  closeOthers: (path: string) => void
  closeRight: (path: string) => void
  closeAll: () => void
  refresh: (path: string) => void
}

/** A flattened menu (menu-tree.js flattenMenus) */
type FlatMenu = MenuNode & { parents: MenuNode[] }

const TagsViewContext = createContext<TagsViewContextValue | null>(null)
const STORAGE_KEY = 'tags-view'
const TITLES: Partial<Record<string, string>> = STATIC_TITLES

const isStoredTab = (t: unknown): t is StoredTab =>
  typeof t === 'object' && t !== null && 'path' in t && typeof t.path === 'string' && 'fullPath' in t && typeof t.fullPath === 'string'

function readStored(): StoredTab[] {
  try {
    const list: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(list) ? list.filter(isStoredTab) : []
  } catch {
    return []
  }
}

export function TagsViewProvider({ children }: { children?: ReactNode }) {
  const { menus } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const flat = useMemo<FlatMenu[]>(() => flattenMenus(menus), [menus])
  const affixPaths = useMemo<string[]>(
    () => navigablePages(flat).filter((m: FlatMenu) => m.parents.length === 0).map((m: FlatMenu) => m.path),
    [flat],
  )
  const isKnown = useCallback((path: string) => Boolean(TITLES[path] || findActiveMenu(flat, path)), [flat])

  const [opened, setOpened] = useState(readStored) // non-affixed tabs, in opening order
  const [versions, setVersions] = useState<Partial<Record<string, number>>>({})
  const [seenKey, setSeenKey] = useState<string | null>(null)

  // Record the current page as a tab on every navigation (derived during render instead of setState in an effect)
  if (location.key !== seenKey) {
    setSeenKey(location.key)
    const path = location.pathname
    if (isKnown(path) && !affixPaths.includes(path)) {
      const fullPath = path + location.search
      setOpened((prev) => {
        const index = prev.findIndex((t) => t.path === path)
        if (index < 0) return [...prev, { path, fullPath }]
        if (prev[index]!.fullPath === fullPath) return prev
        const next = [...prev]
        next[index] = { path, fullPath }
        return next
      })
    }
  }

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(opened))
    } catch {
      /* sessionStorage unavailable: tabs just won't survive a reload */
    }
  }, [opened])

  const tabs = useMemo<Tab[]>(
    () => [
      ...affixPaths.map((path) => ({ path, fullPath: path, affix: true })),
      ...opened.filter((t) => !affixPaths.includes(t.path) && isKnown(t.path)).map((t) => ({ ...t, affix: false })),
    ],
    [affixPaths, opened, isKnown],
  )
  const activePath = location.pathname

  /** Keep the tabs matched by `keep`; if the active tab is dropped, go to `fallback` */
  const retain = useCallback(
    (keep: (tab: StoredTab) => boolean, fallback: StoredTab | null | undefined) => {
      setOpened((prev) => prev.filter(keep))
      const activeKept = tabs.some((t) => t.path === activePath && (t.affix || keep(t)))
      if (!activeKept) navigate(fallback?.fullPath ?? affixPaths[0] ?? '/')
    },
    [tabs, activePath, affixPaths, navigate],
  )

  const close = useCallback(
    (path: string) => {
      const index = tabs.findIndex((t) => t.path === path)
      if (index < 0 || tabs[index]!.affix) return
      retain((t) => t.path !== path, tabs[index + 1] ?? tabs[index - 1])
    },
    [tabs, retain],
  )

  const closeOthers = useCallback(
    (path: string) => retain((t) => t.path === path, tabs.find((t) => t.path === path)),
    [tabs, retain],
  )

  const closeRight = useCallback(
    (path: string) => {
      const index = tabs.findIndex((t) => t.path === path)
      const keep = new Set(tabs.slice(0, index + 1).map((t) => t.path))
      retain((t) => keep.has(t.path), tabs[index])
    },
    [tabs, retain],
  )

  const closeAll = useCallback(() => retain(() => false, null), [retain])

  const refresh = useCallback(
    (path: string) => {
      setVersions((prev) => ({ ...prev, [path]: (prev[path] ?? 0) + 1 }))
      const tab = tabs.find((t) => t.path === path)
      if (path !== activePath && tab) navigate(tab.fullPath)
    },
    [tabs, activePath, navigate],
  )

  const value = useMemo<TagsViewContextValue>(
    () => ({ tabs, activePath, versions, close, closeOthers, closeRight, closeAll, refresh }),
    [tabs, activePath, versions, close, closeOthers, closeRight, closeAll, refresh],
  )
  return <TagsViewContext.Provider value={value}>{children}</TagsViewContext.Provider>
}

/** The tags view state; null outside <TagsViewProvider> */
/** The tab bar state; every caller sits inside <TagsViewProvider> */
export function useTagsView(): TagsViewContextValue {
  const value = useContext(TagsViewContext)
  if (!value) throw new Error('useTagsView() must be used inside <TagsViewProvider>')
  return value
}
