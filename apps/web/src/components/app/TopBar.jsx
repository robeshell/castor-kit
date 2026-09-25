import { Fragment, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
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
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useAuth } from '@/context/AuthContext'
import NotificationBell from '@/components/app/NotificationBell'
import ThemeToggle from '@/components/app/ThemeToggle'
import { findActiveMenu, flattenMenus } from '@/components/app/menu-tree'
import LanguageSwitcher from '@/components/app/LanguageSwitcher'
import { menuLabel } from '@/lib/menu-label'
import { useTranslation } from 'react-i18next'

const STATIC_TITLES = { '/profile': '个人设置', '/403': '无访问权限' }  // 中文原文即 i18n key

export default function TopBar({ onOpenSearch }) {
  const { t } = useTranslation()
  const { menus } = useAuth()
  const location = useLocation()
  const trail = useMemo(() => {
    const active = findActiveMenu(flattenMenus(menus), location.pathname)
    if (active) return [...active.parents.map((p) => ({ name: menuLabel(p) })), { name: menuLabel(active), current: true }]
    const title = STATIC_TITLES[location.pathname]
    return title ? [{ name: t(title), current: true }] : []
  }, [menus, location.pathname, t])

  return (
    <header className="bg-background/80 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b px-4 backdrop-blur-md md:px-6">
      <SidebarTrigger className="-ml-1 size-8" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
      <Breadcrumb className="min-w-0 flex-1">
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
        className="bg-card text-muted-foreground hover:text-foreground hidden h-8 w-64 items-center gap-2 rounded-lg px-2.5 text-[13px] shadow-[0_0_0_1px_var(--border)] transition-colors md:flex"
      >
        <Search className="size-3.5" />
        <span className="flex-1 text-left">{t('搜索或跳转…')}</span>
        <Kbd>⌘K</Kbd>
      </button>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label={t('搜索')}
          className="hover:bg-accent flex size-8 items-center justify-center rounded-md md:hidden"
        >
          <Search className="size-4" />
        </button>
        <NotificationBell />
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </header>
  )
}
