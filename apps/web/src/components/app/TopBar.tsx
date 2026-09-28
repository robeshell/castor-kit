import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Kbd } from '@/components/ui/kbd'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { useTheme } from '@/context/ThemeContext'
import AppearanceMenu from '@/components/app/AppearanceMenu'
import BrandMark from '@/components/app/BrandMark'
import DemoBadge from '@/components/app/DemoBadge'
import NotificationBell from '@/components/app/NotificationBell'
import ThemeToggle from '@/components/app/ThemeToggle'
import TopNav from '@/components/app/TopNav'
import { UserMenuCompact } from '@/components/app/UserMenu'
import { usePageTrail } from '@/components/app/usePageTrail'
import LanguageSwitcher from '@/components/app/LanguageSwitcher'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'


/**
 * Top bar. Desktop content depends on the nav mode: breadcrumbs (sidebar), brand + full menu (top),
 * or top-level section tabs (mixed). Mobile always uses the sidebar sheet + breadcrumbs.
 */
export interface TopBarProps {
  /** Open the ⌘K command menu */
  onOpenSearch: () => void
}

export default function TopBar({ onOpenSearch }: TopBarProps) {
  const { t } = useTranslation()
  const { navMode } = useTheme()
  const { isMobile } = useSidebar()
  const mode = isMobile ? 'sidebar' : navMode
  const trail = usePageTrail()

  return (
    <header className="bg-background/80 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b px-4 backdrop-blur-md md:px-6">
      {mode === 'top' ? (
        <>
          <Link to="/" className="mr-3 flex shrink-0 items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            <BrandMark />
          </Link>
          <TopNav mode="full" className="flex-1" />
        </>
      ) : (
        <>
          <SidebarTrigger className="-ml-1 size-8" />
          <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
        </>
      )}
      {mode === 'mixed' ? <TopNav mode="sections" className="flex-1" /> : null}
      <Breadcrumb className={cn('min-w-0 flex-1', mode !== 'sidebar' && 'hidden')}>
        <BreadcrumbList className="flex-nowrap">
          <BreadcrumbItem className="hidden shrink-0 whitespace-nowrap sm:inline-flex">
            <BreadcrumbLink asChild>
              <Link to="/">{t('工作台')}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {trail.map((item, index) => (
            <Fragment key={`${item.name}-${index}`}>
              <BreadcrumbSeparator className={index === 0 ? 'hidden sm:block' : undefined} />
              <BreadcrumbItem className={item.current ? 'min-w-0' : 'hidden shrink-0 whitespace-nowrap md:inline-flex'}>
                {item.current ? (
                  <BreadcrumbPage className="truncate">{item.name}</BreadcrumbPage>
                ) : (
                  <span className="truncate">{item.name}</span>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <button
        type="button"
        onClick={onOpenSearch}
        className={cn(
          'bg-card text-muted-foreground hover:text-foreground hidden h-8 w-64 shrink-0 items-center gap-2 rounded-lg px-2.5 text-[13px] shadow-[0_0_0_1px_var(--border)] transition-colors',
          // With menus in the top bar the wide search box only fits on large screens
          mode === 'sidebar' ? 'md:flex' : 'xl:flex',
        )}
      >
        <Search className="size-3.5" />
        <span className="flex-1 text-left">{t('搜索或跳转…')}</span>
        <Kbd>⌘K</Kbd>
      </button>
      <div className="flex items-center gap-1">
        <DemoBadge />
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label={t('搜索')}
          className={cn('hover:bg-accent flex size-8 items-center justify-center rounded-md', mode === 'sidebar' ? 'md:hidden' : 'xl:hidden')}
        >
          <Search className="size-4" />
        </button>
        <NotificationBell />
        <LanguageSwitcher />
        <AppearanceMenu />
        <ThemeToggle />
        {mode === 'top' ? <UserMenuCompact /> : null}
      </div>
    </header>
  )
}
