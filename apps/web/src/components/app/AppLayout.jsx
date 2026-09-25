import { Suspense, useMemo, useState } from 'react'
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
import TopBar from '@/components/app/TopBar'
import { findActiveMenu, flattenMenus, sectionOf } from '@/components/app/menu-tree'

/**
 * App shell: sidebar + top bar + content area (a light entrance animation on every route change).
 * Layout follows the appearance settings: nav mode (sidebar / top / mixed), sidebar variant and content width.
 * On mobile every nav mode falls back to the full menu in the sidebar sheet.
 */
export default function AppLayout() {
  const outlet = useOutlet()
  const location = useLocation()
  const { menus } = useAuth()
  const { navMode, sidebarVariant, contentWidth } = useTheme()
  const isMobile = useIsMobile()
  const [searchOpen, setSearchOpen] = useState(false)

  const flat = useMemo(() => flattenMenus(menus), [menus])
  const section = useMemo(() => sectionOf(findActiveMenu(flat, location.pathname)), [flat, location.pathname])
  const showSidebar = isMobile || navMode !== 'top'
  const container = contentContainerClass(contentWidth)

  return (
    <SidebarProvider className="h-svh">
      {showSidebar ? (
        <AppSidebar variant={sidebarVariant} section={!isMobile && navMode === 'mixed' ? section : undefined} />
      ) : null}
      <SidebarInset className={cn('min-w-0 overflow-hidden', !showSidebar && 'md:m-0 md:rounded-none md:shadow-none')}>
        <TopBar onOpenSearch={() => setSearchOpen(true)} />
        <div className="flex-1 overflow-y-auto">
          <Suspense
            fallback={
              <div className={container}>
                <PageLoading />
              </div>
            }
          >
            <motion.div
              key={location.pathname}
              initial={pageTransition.initial}
              animate={pageTransition.animate}
              transition={pageTransition.transition}
              className={container}
            >
              {outlet}
            </motion.div>
          </Suspense>
        </div>
      </SidebarInset>
      <CommandMenu open={searchOpen} onOpenChange={setSearchOpen} />
    </SidebarProvider>
  )
}
