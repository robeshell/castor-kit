import { Activity, Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'
import { motion } from 'motion/react'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { contentContainerClass } from '@/lib/appearance'
import { pageTransition } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import AppSidebar from '@/components/app/AppSidebar'
import { PageLoading } from '@/components/app/StatusPages'
import CommandMenu from '@/components/app/CommandMenu'
import DemoBanner from '@/components/app/DemoBanner'
import TagsView from '@/components/app/TagsView'
import TopBar from '@/components/app/TopBar'
import { TagsViewProvider, useTagsView } from '@/context/TagsViewContext'
import { findActiveMenu, flattenMenus, sectionOf } from '@/components/app/menu-tree'

/**
 * Page area. With the tags view on, every open tab's page stays mounted inside <Activity>:
 * hidden tabs keep their state (filters, pagination, form input) and switching back is instant.
 * Closing a tab drops its page; refreshing a tab remounts it (key includes the tab's version).
 * Scroll position is remembered per page.
 */
function PageArea({ keepAlive, container }) {
  const outlet = useOutlet()
  const location = useLocation()
  const { tabs, versions } = useTagsView()
  const current = location.pathname
  const cacheable = keepAlive && tabs.some((t) => t.path === current)

  // Cached route elements by pathname (updated during render: add the current page, drop closed tabs)
  const [pages, setPages] = useState(() => new Map())
  if (cacheable && !pages.has(current)) setPages((prev) => new Map(prev).set(current, outlet))
  const openPaths = new Set(keepAlive ? tabs.map((t) => t.path) : [])
  if ([...pages.keys()].some((path) => !openPaths.has(path))) {
    setPages((prev) => new Map([...prev].filter(([path]) => openPaths.has(path))))
  }

  const scrollRef = useRef(null)
  const scrollTops = useRef(new Map())
  const version = versions[current] ?? 0
  const scrollVersions = useRef(new Map())
  useLayoutEffect(() => {
    // A refreshed page (new version) starts from the top again
    if (scrollVersions.current.get(current) !== version) {
      scrollVersions.current.set(current, version)
      scrollTops.current.delete(current)
    }
    if (scrollRef.current) scrollRef.current.scrollTop = cacheable ? (scrollTops.current.get(current) ?? 0) : 0
  }, [current, cacheable, version])

  const animated = (key, children) => (
    <motion.div
      key={key}
      initial={pageTransition.initial}
      animate={pageTransition.animate}
      transition={pageTransition.transition}
      className={container}
    >
      {children}
    </motion.div>
  )

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto"
      onScroll={(e) => scrollTops.current.set(current, e.currentTarget.scrollTop)}
    >
      <Suspense
        fallback={
          <div className={container}>
            <PageLoading />
          </div>
        }
      >
        {cacheable
          ? [...pages].map(([path, element]) => {
              const key = `${path}#${versions[path] ?? 0}`
              return (
                <Activity key={key} mode={path === current ? 'visible' : 'hidden'}>
                  {animated(key, element)}
                </Activity>
              )
            })
          : animated(`${current}#${versions[current] ?? 0}`, outlet)}
      </Suspense>
    </div>
  )
}

/**
 * App shell: sidebar + top bar (+ tags view) + content area.
 * Layout follows the appearance settings: nav mode (sidebar / top / mixed), sidebar variant, content width, tags view.
 * On mobile every nav mode falls back to the full menu in the sidebar sheet, and the tags view is hidden.
 */
function Shell() {
  const location = useLocation()
  const { menus } = useAuth()
  const { navMode, sidebarVariant, contentWidth, tagsView } = useTheme()
  const isMobile = useIsMobile()
  const [searchOpen, setSearchOpen] = useState(false)

  const flat = useMemo(() => flattenMenus(menus), [menus])
  const section = useMemo(() => sectionOf(findActiveMenu(flat, location.pathname)), [flat, location.pathname])
  const showSidebar = isMobile || navMode !== 'top'

  return (
    <SidebarProvider className="h-svh">
      {showSidebar ? (
        <AppSidebar variant={sidebarVariant} section={!isMobile && navMode === 'mixed' ? section : undefined} />
      ) : null}
      <SidebarInset className={cn('min-w-0 overflow-hidden', !showSidebar && 'md:m-0 md:rounded-none md:shadow-none')}>
        <DemoBanner />
        <TopBar onOpenSearch={() => setSearchOpen(true)} />
        {tagsView ? <TagsView /> : null}
        <PageArea keepAlive={tagsView && !isMobile} container={contentContainerClass(contentWidth)} />
      </SidebarInset>
      <CommandMenu open={searchOpen} onOpenChange={setSearchOpen} />
    </SidebarProvider>
  )
}

export default function AppLayout() {
  return (
    <TagsViewProvider>
      <Shell />
    </TagsViewProvider>
  )
}
